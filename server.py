import base64, hashlib, hmac, json, mimetypes, os, secrets, sqlite3, webbrowser, threading, time
from datetime import datetime, timedelta, timezone
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

ROOT = os.path.dirname(os.path.abspath(__file__))
PUBLIC = os.path.join(ROOT, 'public')
HOST = os.environ.get('HOST', '0.0.0.0')
try:
    PORT = int(os.environ.get('PORT', '8000'))
except ValueError:
    PORT = 8000
WRITE_LOCK = threading.RLock()

# A partir da V9, os dados ficam fora da pasta do programa.
# Assim, substituir a versão do aplicativo não apaga perfis, posts ou imagens.
def persistent_root():
    configured = os.environ.get('SOCIAUDIO_DATA_ROOT', '').strip()
    if configured:
        return os.path.abspath(configured)
    base = os.environ.get('LOCALAPPDATA')
    if not base:
        base = os.path.join(os.path.expanduser('~'), '.local', 'share')
    return os.path.join(base, 'RedeSociaudio')

DATA_ROOT = persistent_root()
DATA_DIR = os.path.join(DATA_ROOT, 'data')
BACKUP_DIR = os.path.join(DATA_ROOT, 'backups')
UPLOAD_ROOT = os.path.join(DATA_ROOT, 'uploads')
VIDEO_DIR = os.path.join(UPLOAD_ROOT, 'videos')
IMAGE_DIR = os.path.join(UPLOAD_ROOT, 'images')
AUDIO_DIR = os.path.join(UPLOAD_ROOT, 'audio')
FILE_DIR = os.path.join(UPLOAD_ROOT, 'files')
DB = os.path.join(DATA_DIR, 'sociaudio.db')
MIGRATION_MARKER = os.path.join(DATA_ROOT, '.v9_storage_ready')

def candidate_databases():
    candidates = []
    roots = {os.path.dirname(ROOT), os.path.join(os.path.expanduser('~'), 'Downloads')}
    for search_root in roots:
        if not os.path.isdir(search_root):
            continue
        try:
            for dirpath, dirnames, filenames in os.walk(search_root):
                # Limita a busca a pastas relacionadas ao projeto e evita pastas muito profundas.
                rel = os.path.relpath(dirpath, search_root)
                if rel.count(os.sep) > 4:
                    dirnames[:] = []
                    continue
                if 'sociaudio.db' not in filenames:
                    continue
                path = os.path.join(dirpath, 'sociaudio.db')
                if os.path.abspath(path) in {os.path.abspath(DB), os.path.abspath(os.path.join(ROOT, 'data', 'sociaudio.db'))}:
                    continue
                lower = path.lower()
                if 'rede-sociaudio' in lower or 'redesociaudio' in lower:
                    candidates.append(path)
        except OSError:
            pass
    return sorted(set(candidates), key=lambda x: os.path.getmtime(x), reverse=True)

def prepare_persistent_storage():
    import shutil
    os.makedirs(DATA_DIR, exist_ok=True)
    os.makedirs(BACKUP_DIR, exist_ok=True)
    os.makedirs(VIDEO_DIR, exist_ok=True)
    os.makedirs(IMAGE_DIR, exist_ok=True)
    os.makedirs(AUDIO_DIR, exist_ok=True)
    os.makedirs(FILE_DIR, exist_ok=True)
    if not os.path.exists(DB):
        candidates = candidate_databases()
        if candidates:
            source = candidates[0]
            shutil.copy2(source, DB)
            print(f' Dados importados automaticamente de: {source}')
        else:
            legacy = os.path.join(ROOT, 'data', 'sociaudio.db')
            if os.path.exists(legacy):
                shutil.copy2(legacy, DB)
                print(' Banco inicial copiado para o armazenamento permanente.')
    # Backup diário simples antes de iniciar.
    if os.path.exists(DB):
        stamp = datetime.now().strftime('%Y-%m-%d')
        backup = os.path.join(BACKUP_DIR, f'sociaudio-{stamp}.db')
        if not os.path.exists(backup):
            try:
                shutil.copy2(DB, backup)
            except OSError:
                pass
    try:
        Path = __import__('pathlib').Path
        Path(MIGRATION_MARKER).write_text('Rede Sociaudio V20.2 - Busca de contatos aprimorada', encoding='utf-8')
    except Exception:
        pass


def connect():
    # Uma conexão por requisição. WAL permite leituras enquanto existe uma escrita.
    c = sqlite3.connect(DB, timeout=30, isolation_level=None)
    c.row_factory = sqlite3.Row
    c.execute('PRAGMA foreign_keys=ON')
    c.execute('PRAGMA journal_mode=WAL')
    c.execute('PRAGMA synchronous=NORMAL')
    c.execute('PRAGMA busy_timeout=30000')
    return c


def write_transaction(callback, retries=5):
    """Executa uma escrita com bloqueio local, rollback e repetição segura."""
    last_error = None
    with WRITE_LOCK:
        for attempt in range(retries):
            c = connect()
            try:
                c.execute('BEGIN IMMEDIATE')
                result = callback(c)
                c.commit()
                return result
            except sqlite3.OperationalError as exc:
                last_error = exc
                try: c.rollback()
                except Exception: pass
                if 'locked' not in str(exc).lower() or attempt == retries - 1:
                    raise
                time.sleep(0.15 * (attempt + 1))
            except Exception:
                try: c.rollback()
                except Exception: pass
                raise
            finally:
                c.close()
        raise last_error


def now():
    return datetime.now(timezone.utc).isoformat()

def valid_url(value):
    value=(value or '').strip()
    if not value:
        return ''
    try:
        parsed=urlparse(value)
        if parsed.scheme in ('http','https') and parsed.netloc:
            return value[:2000]
    except Exception:
        pass
    return ''




PLAN_LIMITS = {
    'free': 250 * 1024 * 1024,
    'pro': 2 * 1024 * 1024 * 1024,
    'company': 5 * 1024 * 1024 * 1024,
    'admin': 5 * 1024 * 1024 * 1024,
}
PLAN_LABELS = {'free':'Gratuito','pro':'Profissional PRO','company':'Empresa','admin':'Administrador'}
AUDIO_PLAN_LIMITS = {
    'free': 100 * 1024 * 1024,
    'pro': 500 * 1024 * 1024,
    'company': 2 * 1024 * 1024 * 1024,
    'admin': 2 * 1024 * 1024 * 1024,
}
ALLOWED_AUDIO_TYPES = {
    'audio/mpeg': '.mp3', 'audio/mp3': '.mp3', 'audio/wav': '.wav',
    'audio/x-wav': '.wav', 'audio/ogg': '.ogg', 'audio/mp4': '.m4a',
    'audio/aac': '.aac', 'audio/flac': '.flac', 'audio/x-flac': '.flac'
}

# Arquivos úteis para a comunidade de áudio. Executáveis e scripts ficam bloqueados.
ALLOWED_FILE_EXTENSIONS = {
    '.pdf','.doc','.docx','.odt','.rtf','.txt','.md',
    '.xls','.xlsx','.ods','.csv',
    '.ppt','.pptx','.odp',
    '.zip','.rar','.7z',
    '.xml','.json','.yaml','.yml',
    '.rew','.mdat','.trace','.frd','.zma','.cal','.mic',
    '.ssn','.scn','.scene','.show','.preset','.fxp','.fxb','.vstpreset',
    '.ir','.syx','.mid','.midi','.cue','.rider'
}
DOCUMENT_EXTENSIONS = {'.pdf','.doc','.docx','.odt','.rtf','.txt','.md','.xls','.xlsx','.ods','.csv','.ppt','.pptx','.odp','.xml','.json','.yaml','.yml'}
ARCHIVE_EXTENSIONS = {'.zip','.rar','.7z'}
FILE_PLAN_LIMITS = {
    'free': {'document':100*1024*1024, 'archive':500*1024*1024, 'technical':250*1024*1024},
    'pro': {'document':500*1024*1024, 'archive':2*1024*1024*1024, 'technical':1*1024*1024*1024},
    'company': {'document':2*1024*1024*1024, 'archive':5*1024*1024*1024, 'technical':2*1024*1024*1024},
    'admin': {'document':2*1024*1024*1024, 'archive':5*1024*1024*1024, 'technical':5*1024*1024*1024},
}

def safe_original_filename(value):
    name=os.path.basename((value or 'arquivo').replace('\\','/')).strip().replace('\x00','')
    return (name or 'arquivo')[:220]

def file_category_for_extension(ext):
    if ext in DOCUMENT_EXTENSIONS: return 'document'
    if ext in ARCHIVE_EXTENSIONS: return 'archive'
    return 'technical'

def file_limit_for(user, ext):
    return FILE_PLAN_LIMITS[normalized_plan(user)][file_category_for_extension(ext)]

def normalized_plan(user):
    if not user:
        return 'free'
    if user.get('is_admin'):
        return 'admin'
    plan=(user.get('plan') or 'free').lower()
    return plan if plan in PLAN_LIMITS else 'free'

def video_limit_for(user):
    return PLAN_LIMITS[normalized_plan(user)]

def audio_limit_for(user):
    return AUDIO_PLAN_LIMITS[normalized_plan(user)]

def human_mb(value):
    return f'{value / (1024*1024):.0f} MB' if value < 1024**3 else f'{value / (1024**3):.0f} GB'

def media_file_path(media_url):
    """Converte /media/videos/arquivo em caminho seguro dentro do armazenamento permanente."""
    if not isinstance(media_url, str) or not media_url.startswith('/media/'):
        return None
    rel = media_url[len('/media/'):].replace('\\', '/')
    full = os.path.abspath(os.path.join(UPLOAD_ROOT, rel))
    root = os.path.abspath(UPLOAD_ROOT)
    if not full.startswith(root + os.sep):
        return None
    return full


def remove_media_file(media_url):
    full = media_file_path(media_url)
    if full and os.path.isfile(full):
        try:
            os.remove(full)
        except OSError:
            pass


def store_media_data(media, media_type='', media_name='', max_video_bytes=None):
    """Salva vídeos/imagens Data URL no disco e devolve uma URL local persistente."""
    if not media:
        return '', media_type or '', media_name or ''
    if isinstance(media, str) and media.startswith('/media/'):
        return media, media_type or mimetypes.guess_type(media)[0] or '', media_name or os.path.basename(media)
    if not isinstance(media, str) or not media.startswith('data:') or ',' not in media:
        raise ValueError('Formato de mídia inválido.')
    header, encoded = media.split(',', 1)
    detected = header[5:].split(';', 1)[0].lower()
    if detected not in {'video/mp4','video/webm','image/jpeg','image/png','image/webp','image/gif'}:
        raise ValueError('Formato de mídia não permitido.')
    try:
        raw = base64.b64decode(encoded, validate=True)
    except Exception as exc:
        raise ValueError('Não foi possível processar o arquivo enviado.') from exc
    if detected.startswith('video/'):
        limit = max_video_bytes or PLAN_LIMITS['free']
        if len(raw) > limit:
            raise ValueError(f'O vídeo ultrapassa o limite do seu plano ({human_mb(limit)}).')
    if detected.startswith('image/') and len(raw) > 8 * 1024 * 1024:
        raise ValueError('A imagem deve ter no máximo 8 MB.')
    extensions = {'video/mp4':'.mp4','video/webm':'.webm','image/jpeg':'.jpg','image/png':'.png','image/webp':'.webp','image/gif':'.gif'}
    folder = VIDEO_DIR if detected.startswith('video/') else IMAGE_DIR
    kind = 'videos' if detected.startswith('video/') else 'images'
    filename = f"{datetime.now().strftime('%Y%m%d%H%M%S')}-{secrets.token_hex(8)}{extensions[detected]}"
    full = os.path.join(folder, filename)
    with open(full, 'wb') as fh:
        fh.write(raw)
    return f'/media/{kind}/{filename}', detected, (media_name or filename)[:220]


def password_hash(password, salt=None):
    salt = salt or secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac('sha256', password.encode(), salt, 180_000)
    return base64.b64encode(salt + digest).decode()


def password_ok(password, stored):
    try:
        raw = base64.b64decode(stored)
        salt, expected = raw[:16], raw[16:]
        actual = hashlib.pbkdf2_hmac('sha256', password.encode(), salt, 180_000)
        return hmac.compare_digest(actual, expected)
    except Exception:
        # compatibilidade com a senha da V3
        legacy = hashlib.sha256(('sociaudio:' + password).encode()).hexdigest()
        return hmac.compare_digest(legacy, stored)


def init_db():
    os.makedirs(os.path.dirname(DB), exist_ok=True)
    c = connect()
    c.execute('BEGIN IMMEDIATE')
    c.executescript('''
    CREATE TABLE IF NOT EXISTS users(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'Estudante',
      city TEXT DEFAULT '', bio TEXT DEFAULT '', specialties TEXT DEFAULT '',
      experience TEXT DEFAULT '', equipment TEXT DEFAULT '',
      avatar TEXT DEFAULT '', is_admin INTEGER DEFAULT 0,
      status TEXT DEFAULT 'active', created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions(
      token TEXT PRIMARY KEY, user_id INTEGER NOT NULL,
      expires_at TEXT NOT NULL, created_at TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS posts(
      id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL,
      type TEXT NOT NULL DEFAULT 'Pergunta', category TEXT NOT NULL DEFAULT 'Geral',
      title TEXT NOT NULL, body TEXT NOT NULL, is_featured INTEGER DEFAULT 0,
      status TEXT DEFAULT 'published', image_data TEXT DEFAULT '', created_at TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS comments(
      id INTEGER PRIMARY KEY AUTOINCREMENT, post_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL, body TEXT NOT NULL, is_solution INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY(post_id) REFERENCES posts(id) ON DELETE CASCADE,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS likes(
      user_id INTEGER NOT NULL, post_id INTEGER NOT NULL,
      PRIMARY KEY(user_id,post_id),
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(post_id) REFERENCES posts(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS bookmarks(
      user_id INTEGER NOT NULL, post_id INTEGER NOT NULL,
      PRIMARY KEY(user_id,post_id),
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(post_id) REFERENCES posts(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS communities(
      id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE NOT NULL,
      description TEXT NOT NULL, icon TEXT DEFAULT '🎛️', category TEXT DEFAULT 'Geral',
      created_by INTEGER, created_at TEXT NOT NULL,
      FOREIGN KEY(created_by) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS follows(
      follower_id INTEGER NOT NULL, followed_id INTEGER NOT NULL, created_at TEXT NOT NULL,
      PRIMARY KEY(follower_id,followed_id),
      FOREIGN KEY(follower_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(followed_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS notifications(
      id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, actor_id INTEGER,
      type TEXT NOT NULL, message TEXT NOT NULL, post_id INTEGER, is_read INTEGER DEFAULT 0, created_at TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(actor_id) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY(post_id) REFERENCES posts(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS community_members(
      community_id INTEGER NOT NULL, user_id INTEGER NOT NULL,
      joined_at TEXT NOT NULL, PRIMARY KEY(community_id,user_id),
      FOREIGN KEY(community_id) REFERENCES communities(id) ON DELETE CASCADE,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS quote_requests(
      id INTEGER PRIMARY KEY AUTOINCREMENT, professional_id INTEGER NOT NULL,
      requester_id INTEGER NOT NULL, requester_name TEXT NOT NULL,
      requester_phone TEXT DEFAULT '', city TEXT DEFAULT '', event_date TEXT DEFAULT '',
      event_type TEXT DEFAULT '', audience TEXT DEFAULT '', message TEXT NOT NULL,
      status TEXT DEFAULT 'novo', created_at TEXT NOT NULL,
      FOREIGN KEY(professional_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(requester_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS service_requests(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      requester_id INTEGER NOT NULL,
      requester_name TEXT NOT NULL,
      requester_phone TEXT DEFAULT '',
      city TEXT DEFAULT '', event_date TEXT DEFAULT '',
      event_type TEXT DEFAULT '', audience TEXT DEFAULT '',
      budget TEXT DEFAULT '', equipment TEXT DEFAULT '',
      message TEXT NOT NULL, status TEXT DEFAULT 'aberto', created_at TEXT NOT NULL,
      FOREIGN KEY(requester_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS service_request_matches(
      request_id INTEGER NOT NULL, professional_id INTEGER NOT NULL,
      score INTEGER DEFAULT 0, status TEXT DEFAULT 'recomendado', created_at TEXT NOT NULL,
      PRIMARY KEY(request_id, professional_id),
      FOREIGN KEY(request_id) REFERENCES service_requests(id) ON DELETE CASCADE,
      FOREIGN KEY(professional_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS companies(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_id INTEGER NOT NULL,
      name TEXT UNIQUE NOT NULL,
      category TEXT DEFAULT 'Empresa de áudio',
      tagline TEXT DEFAULT '', description TEXT DEFAULT '', city TEXT DEFAULT '',
      service_region TEXT DEFAULT '', phone TEXT DEFAULT '', whatsapp TEXT DEFAULT '',
      email TEXT DEFAULT '', instagram TEXT DEFAULT '', website TEXT DEFAULT '',
      logo TEXT DEFAULT '', cover TEXT DEFAULT '', verified INTEGER DEFAULT 0,
      status TEXT DEFAULT 'active', created_at TEXT NOT NULL, updated_at TEXT DEFAULT '',
      FOREIGN KEY(owner_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS company_services(
      id INTEGER PRIMARY KEY AUTOINCREMENT, company_id INTEGER NOT NULL,
      title TEXT NOT NULL, description TEXT DEFAULT '', icon TEXT DEFAULT '🎚️',
      FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS company_team(
      id INTEGER PRIMARY KEY AUTOINCREMENT, company_id INTEGER NOT NULL,
      name TEXT NOT NULL, role TEXT DEFAULT '', bio TEXT DEFAULT '', photo TEXT DEFAULT '',
      FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS company_projects(
      id INTEGER PRIMARY KEY AUTOINCREMENT, company_id INTEGER NOT NULL,
      title TEXT NOT NULL, description TEXT DEFAULT '', image TEXT DEFAULT '', link_url TEXT DEFAULT '',
      FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS jobs(
      id INTEGER PRIMARY KEY AUTOINCREMENT, creator_id INTEGER NOT NULL, company_id INTEGER,
      title TEXT NOT NULL, category TEXT DEFAULT 'Áudio ao vivo', city TEXT DEFAULT '',
      work_mode TEXT DEFAULT 'Presencial', contract_type TEXT DEFAULT 'Freelancer',
      event_date TEXT DEFAULT '', compensation TEXT DEFAULT '', description TEXT NOT NULL,
      requirements TEXT DEFAULT '', contact_phone TEXT DEFAULT '', status TEXT DEFAULT 'aberta',
      created_at TEXT NOT NULL, updated_at TEXT DEFAULT '',
      FOREIGN KEY(creator_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE SET NULL
    );
    CREATE TABLE IF NOT EXISTS job_applications(
      id INTEGER PRIMARY KEY AUTOINCREMENT, job_id INTEGER NOT NULL, user_id INTEGER NOT NULL,
      message TEXT NOT NULL, phone TEXT DEFAULT '', status TEXT DEFAULT 'enviada', created_at TEXT NOT NULL,
      UNIQUE(job_id,user_id),
      FOREIGN KEY(job_id) REFERENCES jobs(id) ON DELETE CASCADE,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS marketplace_listings(
      id INTEGER PRIMARY KEY AUTOINCREMENT, seller_id INTEGER NOT NULL,
      title TEXT NOT NULL, category TEXT DEFAULT 'Outros', listing_type TEXT DEFAULT 'Venda',
      price TEXT DEFAULT '', item_condition TEXT DEFAULT 'Usado', city TEXT DEFAULT '',
      description TEXT NOT NULL, contact_phone TEXT DEFAULT '', image_data TEXT DEFAULT '',
      status TEXT DEFAULT 'ativo', created_at TEXT NOT NULL, updated_at TEXT DEFAULT '',
      FOREIGN KEY(seller_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS knowledge_articles(
      id INTEGER PRIMARY KEY AUTOINCREMENT, author_id INTEGER NOT NULL,
      title TEXT NOT NULL, category TEXT DEFAULT 'Fundamentos', summary TEXT DEFAULT '',
      body TEXT NOT NULL, cover_data TEXT DEFAULT '', link_url TEXT DEFAULT '',
      difficulty TEXT DEFAULT 'Iniciante', is_featured INTEGER DEFAULT 0,
      status TEXT DEFAULT 'published', views INTEGER DEFAULT 0,
      created_at TEXT NOT NULL, updated_at TEXT DEFAULT '',
      FOREIGN KEY(author_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS audio_ai_sessions(
      id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL,
      title TEXT DEFAULT 'Nova conversa', mode TEXT DEFAULT 'Pergunta técnica',
      created_at TEXT NOT NULL, updated_at TEXT DEFAULT '',
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS audio_ai_messages(
      id INTEGER PRIMARY KEY AUTOINCREMENT, session_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL, role TEXT NOT NULL,
      body TEXT NOT NULL, metadata TEXT DEFAULT '', created_at TEXT NOT NULL,
      FOREIGN KEY(session_id) REFERENCES audio_ai_sessions(id) ON DELETE CASCADE,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS conversations(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS conversation_members(
      conversation_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      joined_at TEXT NOT NULL,
      PRIMARY KEY(conversation_id,user_id),
      FOREIGN KEY(conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS chat_messages(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id INTEGER NOT NULL,
      sender_id INTEGER NOT NULL,
      body TEXT DEFAULT '',
      attachment_url TEXT DEFAULT '',
      attachment_name TEXT DEFAULT '',
      attachment_type TEXT DEFAULT '',
      attachment_size INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      read_at TEXT DEFAULT '',
      FOREIGN KEY(conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
      FOREIGN KEY(sender_id) REFERENCES users(id) ON DELETE CASCADE
    );
    ''')
    # Migração leve da V3
    cols = {r['name'] for r in c.execute('PRAGMA table_info(users)')}
    additions = {
        'specialties': "TEXT DEFAULT ''", 'experience': "TEXT DEFAULT ''",
        'equipment': "TEXT DEFAULT ''", 'avatar': "TEXT DEFAULT ''",
        'cover': "TEXT DEFAULT ''", 'services': "TEXT DEFAULT ''",
        'certifications': "TEXT DEFAULT ''", 'service_region': "TEXT DEFAULT ''",
        'whatsapp': "TEXT DEFAULT ''", 'instagram': "TEXT DEFAULT ''",
        'website': "TEXT DEFAULT ''", 'availability': "TEXT DEFAULT 'Disponível para trabalhos'",
        'headline': "TEXT DEFAULT ''", 'company': "TEXT DEFAULT ''",
        'response_time': "TEXT DEFAULT 'Responde em até 24 horas'", 'completed_projects': "TEXT DEFAULT ''",
        'portfolio_links': "TEXT DEFAULT ''", 'work_history': "TEXT DEFAULT ''",
        'status': "TEXT DEFAULT 'active'",
        'plan': "TEXT DEFAULT 'free'", 'upload_used_bytes': "INTEGER DEFAULT 0"
    }
    for name, typ in additions.items():
        if name not in cols:
            c.execute(f'ALTER TABLE users ADD COLUMN {name} {typ}')
    pcols = {r['name'] for r in c.execute('PRAGMA table_info(posts)')}
    for name, typ in [('is_featured', 'INTEGER DEFAULT 0'), ('status', "TEXT DEFAULT 'published'"), ('image_data', "TEXT DEFAULT ''"), ('updated_at', "TEXT DEFAULT ''"), ('media_data', "TEXT DEFAULT ''"), ('media_type', "TEXT DEFAULT ''"), ('media_name', "TEXT DEFAULT ''"), ('media_size', 'INTEGER DEFAULT 0')]:
        if name not in pcols: c.execute(f'ALTER TABLE posts ADD COLUMN {name} {typ}')
    if 'link_url' not in pcols: c.execute("ALTER TABLE posts ADD COLUMN link_url TEXT DEFAULT ''")
    # Migra imagens antigas para o novo campo de mídia sem perder publicações existentes.
    c.execute("UPDATE posts SET media_data=image_data, media_type='image/jpeg' WHERE COALESCE(media_data,'')='' AND COALESCE(image_data,'')<>''")
    ccols = {r['name'] for r in c.execute('PRAGMA table_info(comments)')}
    if 'is_solution' not in ccols: c.execute('ALTER TABLE comments ADD COLUMN is_solution INTEGER DEFAULT 0')

    founder = c.execute('SELECT * FROM users WHERE email=?', ('edson@sociaudio.com',)).fetchone()
    if not founder:
        c.execute('''INSERT INTO users(name,email,password,role,city,bio,specialties,experience,equipment,is_admin,status,created_at)
                     VALUES(?,?,?,?,?,?,?,?,?,1,'active',?)''',
                  ('Edson Borges','edson@sociaudio.com',password_hash('123456'),'Fundador / Técnico de Áudio',
                   'Joinville - SC','Fundador da Rede Sociaudio e profissional de áudio.',
                   'Mixagem ao vivo, Igrejas, Sistemas de PA','Mais de 20 anos','Ui24R, M32, mesas digitais',now()))
        founder_id = c.execute('SELECT last_insert_rowid()').fetchone()[0]
    else:
        founder_id = founder['id']
        c.execute("UPDATE users SET plan='admin' WHERE id=?", (founder_id,))
        if password_ok('123456', founder['password']) and len(founder['password']) < 90:
            c.execute('UPDATE users SET password=? WHERE id=?', (password_hash('123456'), founder_id))

    if c.execute('SELECT COUNT(*) FROM posts').fetchone()[0] == 0:
        c.execute('''INSERT INTO posts(user_id,type,category,title,body,is_featured,status,created_at)
                     VALUES(?,?,?,?,?,1,'published',?)''',
                  (founder_id,'Pergunta','Mesas Digitais','Como eliminar microfonia em uma igreja?',
                   'Quais são os primeiros ajustes que vocês recomendam em uma mesa digital?',now()))
    defaults = [
        ('Soundcraft Ui24R','Troca de experiências, cenas, rede e solução de problemas da Ui24R.','🎚️','Mesas Digitais'),
        ('Áudio para Igrejas','Mixagem, acústica, transmissão e capacitação de equipes de igrejas.','⛪','Igrejas'),
        ('Midas M32 / Behringer X32','Configurações, roteamento, efeitos, gravação e operação.','🎛️','Mesas Digitais'),
        ('Acústica e Sistemas de PA','Tratamento, alinhamento, subwoofers e otimização de sistemas.','🔊','PA e Acústica')]
    for name, desc, icon, category in defaults:
        c.execute('INSERT OR IGNORE INTO communities(name,description,icon,category,created_by,created_at) VALUES(?,?,?,?,?,?)',
                  (name,desc,icon,category,founder_id,now()))
    company = c.execute('SELECT id FROM companies WHERE owner_id=?',(founder_id,)).fetchone()
    if not company:
        c.execute('''INSERT INTO companies(owner_id,name,category,tagline,description,city,service_region,whatsapp,email,instagram,website,verified,status,created_at,updated_at)
                     VALUES(?,?,?,?,?,?,?,?,?,?,?,1,'active',?,?)''',
                  (founder_id,'EB Áudio','Serviços de áudio profissional','Clareza, controle e excelência em cada projeto.',
                   'Soluções profissionais para igrejas, eventos, empresas e equipes técnicas, com consultoria, instalação, operação e treinamento.',
                   'Joinville - SC','Santa Catarina e atendimento remoto','','','','',now(),now()))
        cid=c.execute('SELECT last_insert_rowid()').fetchone()[0]
        for title,desc,icon in [
            ('Consultoria técnica','Diagnóstico, planejamento e otimização de sistemas de áudio.','🎯'),
            ('Instalação e projetos','Projeto, instalação e configuração de sistemas para igrejas e eventos.','🔊'),
            ('Treinamento de equipes','Capacitação prática para operadores e equipes de mídia.','🎓')]:
            c.execute('INSERT INTO company_services(company_id,title,description,icon) VALUES(?,?,?,?)',(cid,title,desc,icon))
    c.commit(); c.close()


def public_user(row):
    data={k: row[k] for k in ('id','name','email','role','city','bio','specialties','experience','equipment','avatar','cover','services','certifications','service_region','whatsapp','instagram','website','availability','headline','company','response_time','completed_projects','portfolio_links','work_history','plan','upload_used_bytes','is_admin','status','created_at') if k in row.keys()}
    plan=normalized_plan(data)
    data['plan']=plan
    data['plan_label']=PLAN_LABELS[plan]
    data['video_limit_bytes']=PLAN_LIMITS[plan]
    data['video_limit_label']=human_mb(PLAN_LIMITS[plan])
    data['audio_limit_bytes']=AUDIO_PLAN_LIMITS[plan]
    data['audio_limit_label']=human_mb(AUDIO_PLAN_LIMITS[plan])
    data['document_limit_label']=human_mb(FILE_PLAN_LIMITS[plan]['document'])
    data['archive_limit_label']=human_mb(FILE_PLAN_LIMITS[plan]['archive'])
    data['technical_file_limit_label']=human_mb(FILE_PLAN_LIMITS[plan]['technical'])
    return data


def auth_user(headers):
    token = headers.get('Authorization','').replace('Bearer ','').strip()
    if not token: return None
    c = connect()
    row = c.execute('''SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id
                       WHERE s.token=? AND s.expires_at>? AND u.status='active' ''', (token, now())).fetchone()
    c.close()
    return public_user(row) if row else None


def new_session(c, user_id):
    token = secrets.token_urlsafe(32)
    expires = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
    c.execute('INSERT INTO sessions(token,user_id,expires_at,created_at) VALUES(?,?,?,?)', (token,user_id,expires,now()))
    return token


class SociaudioServer(ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = True



def audio_ai_answer(question, mode='Pergunta técnica', symptom='', context=''):
    """Assistente técnico offline baseado em regras. Não substitui medição no local."""
    q = ' '.join([question or '', symptom or '', context or '']).lower()
    title = 'Diagnóstico técnico inicial'
    likely=[]; actions=[]; checks=[]
    if any(k in q for k in ('microfonia','feedback','apitando','apito')):
        title='Controle de microfonia'
        likely=['Microfone apontado para a caixa ou monitor','Ganho excessivo em algum estágio','Frequência ressonante do ambiente ou do sistema','Muitos microfones abertos simultaneamente']
        actions=['Abaixe primeiro o envio do canal para o monitor ou o master em 3 a 6 dB','Reposicione caixa, monitor e microfone para aumentar a rejeição','Use HPF adequado à fonte e procure a frequência crítica com cortes estreitos e moderados','Feche canais que não estão sendo usados e refaça o ganho com PFL']
        checks=['O sinal clipa no pré-amplificador?','A microfonia ocorre no PA, no retorno ou nos dois?','Qual microfone e qual mesa estão sendo usados?']
    elif any(k in q for k in ('voz abafada','embolada','boxy','abafado','abafada','embolado')):
        title='Voz abafada ou embolada'
        likely=['Acúmulo entre 180 e 400 Hz','HPF muito baixo ou desligado','Efeito/reverb em excesso','Microfone muito próximo ou com efeito de proximidade']
        actions=['Ative o HPF e teste entre 80 e 120 Hz, conforme a voz','Faça uma redução ampla e leve entre 220 e 350 Hz','Reduza o reverb temporariamente para separar problema tonal de ambiência','Verifique posicionamento do microfone e técnica do cantor']
        checks=['Compare com o canal sem EQ','Escute em fone/PFL para separar PA e fonte','A voz fica abafada também na gravação?']
    elif any(k in q for k in ('estridente','áspera','agressiva','agudo demais','sibilante')):
        title='Voz estridente ou sibilante'
        likely=['Excesso entre 2,5 e 5 kHz','Sibilância entre 5 e 9 kHz','Caixa apontada diretamente para superfícies refletoras','Compressão muito rápida realçando aspereza']
        actions=['Teste uma redução de 1 a 3 dB entre 3 e 4,5 kHz','Use de-esser somente se a sibilância for consistente','Revise ataque do compressor; ataques extremamente rápidos podem endurecer a voz','Compare o resultado em volume moderado, sem equalizar em SPL excessivo']
        checks=['O problema está no microfone ou no PA?','Acontece com todas as vozes?','Existe clipping em algum ponto?']
    elif any(k in q for k in ('clipping','clipando','distorção','distorcendo')):
        title='Clipping e distorção'
        likely=['Pré-amplificador saturando','Soma de buses ou master acima do headroom','Processador, amplificador ou caixa ativa recebendo nível excessivo','Fonte já distorcida antes da mesa']
        actions=['Use PFL/Solo e verifique o nível desde a entrada até o master','Reduza o ganho no primeiro ponto que estiver clipando, não apenas o fader','Confira sends, matrizes, processadores e entradas dos amplificadores','Desative temporariamente makeup gain e boosts para localizar a saturação']
        checks=['Qual LED ou medidor acusa clip?','A distorção permanece com o fader baixo?','O sinal gravado direto também está distorcido?']
    elif any(k in q for k in ('ruído','chiado','hum','ronco','zumbido')):
        title='Ruído, chiado ou ronco'
        likely=['Ganho insuficiente seguido de compensação no fader','Cabo, conector ou fonte com defeito','Loop de terra','Interferência de energia, iluminação ou RF']
        actions=['Mute os canais um a um até localizar a origem','Troque cabo e entrada antes de aplicar EQ','Separe cabos de áudio e energia e teste outra alimentação','Use conexões balanceadas e evite adaptadores desnecessários']
        checks=['O ruído muda ao tocar no equipamento?','É 50/60 Hz ou chiado de alta frequência?','Aparece em um canal ou no sistema inteiro?']
    elif any(k in q for k in ('compressor','compressão')):
        title='Ponto de partida para compressão'
        likely=['A configuração ideal depende da fonte, dinâmica e objetivo']
        actions=['Comece com ratio entre 2:1 e 4:1','Ajuste o threshold para obter cerca de 3 a 6 dB de redução nos picos','Use ataque de 10 a 30 ms para preservar naturalidade vocal e release de 60 a 150 ms','Compare com bypass no mesmo volume antes de decidir']
        checks=['O compressor está controlando picos ou mudando timbre?','O makeup gain está mascarando a comparação?','A redução de ganho volta a zero entre frases?']
    elif any(k in q for k in ('ui24','ui24r','x32','m32','wing','sq5','avantis','dm3','mesa digital')):
        title='Fluxo seguro para mesa digital'
        likely=['Problemas comuns envolvem ganho, roteamento, sends pré/pós e patch']
        actions=['Confirme o patch físico e digital do canal','Faça ganho com PFL antes de equalização e compressão','Verifique se o canal está enviado ao LR, buses e matrizes corretos','Salve uma cena de segurança antes de mudanças maiores']
        checks=['Qual modelo exato e versão de firmware?','O problema está na entrada, no bus ou na saída?','Existe sinal no medidor do canal?']
    elif any(k in q for k in ('rta','analisador','espectro','frequência')):
        title='Leitura responsável de RTA'
        likely=['Um RTA mostra energia, mas não identifica sozinho a causa ou a qualidade percebida']
        actions=['Use sinal e microfone de medição adequados','Compare várias posições em vez de corrigir um único ponto','Separe resposta do sistema, sala e conteúdo musical','Evite correções extremas baseadas apenas em uma captura']
        checks=['A medição foi feita com ruído rosa ou programa musical?','O microfone é calibrado?','Qual suavização e janela estão sendo usadas?']
    elif any(k in q for k in ('retorno','monitor','in-ear','inear')):
        title='Diagnóstico de retorno/monitor'
        likely=['Send incorreto, pré/pós-fader inadequado, ganho ruim ou excesso de fontes no mix']
        actions=['Confirme o bus e a saída física do monitor','Use pré-fader para manter independência do PA quando necessário','Construa o mix começando pela voz principal e adicione apenas o essencial','Aplique HPF e controle frequências críticas antes de aumentar volume']
        checks=['Há sinal no medidor do bus?','O problema é volume, clareza ou microfonia?','O monitor é ativo, passivo ou in-ear?']
    else:
        title='Orientação técnica inicial'
        likely=['Ainda faltam informações para um diagnóstico confiável']
        actions=['Descreva a fonte sonora, mesa, caixas e ambiente','Informe em qual ponto o problema aparece: entrada, canal, bus ou saída','Teste uma alteração por vez e salve a configuração atual','Compare o sinal com processamento em bypass']
        checks=['Quando o problema começou?','Ele ocorre em todos os canais?','Quais equipamentos e conexões estão envolvidos?']
    return {'title':title,'likely':likely,'actions':actions,'checks':checks,
            'notice':'Sugestões iniciais. Confirme ouvindo e medindo no sistema real; evite alterações bruscas durante um evento.'}

class Handler(SimpleHTTPRequestHandler):
    def log_message(self, fmt, *args):
        print('[HTTP]', fmt % args)

    def send_json(self, obj, status=200):
        body = json.dumps(obj, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type','application/json; charset=utf-8')
        self.send_header('Cache-Control','no-store')
        self.send_header('Content-Length',str(len(body)))
        self.end_headers(); self.wfile.write(body)

    def read_json(self):
        try:
            n = int(self.headers.get('Content-Length','0'))
            return json.loads(self.rfile.read(n) or b'{}')
        except Exception:
            return {}

    def require_user(self):
        u = auth_user(self.headers)
        if not u: self.send_json({'error':'Sessão inválida. Entre novamente.'},401)
        return u

    def do_GET(self):
        parsed = urlparse(self.path); p = parsed.path; qs = parse_qs(parsed.query)
        if p.startswith('/media/'):
            full = media_file_path(p)
            if not full or not os.path.isfile(full):
                return self.send_json({'error':'Arquivo não encontrado.'},404)
            total = os.path.getsize(full)
            content_type = mimetypes.guess_type(full)[0] or 'application/octet-stream'
            range_header = self.headers.get('Range','').strip()
            start, end = 0, total - 1
            status = 200
            if range_header.startswith('bytes='):
                try:
                    spec = range_header[6:].split(',',1)[0]
                    left, right = spec.split('-',1)
                    if left:
                        start = int(left)
                        end = int(right) if right else total - 1
                    else:
                        suffix = int(right)
                        start = max(0, total - suffix)
                    end = min(end, total - 1)
                    if start < 0 or start > end or start >= total:
                        self.send_response(416)
                        self.send_header('Content-Range', f'bytes */{total}')
                        self.end_headers(); return
                    status = 206
                except Exception:
                    start, end, status = 0, total - 1, 200
            length = end - start + 1
            self.send_response(status)
            self.send_header('Content-Type', content_type)
            self.send_header('Accept-Ranges','bytes')
            self.send_header('Content-Length',str(length))
            if status == 206:
                self.send_header('Content-Range',f'bytes {start}-{end}/{total}')
            self.send_header('Cache-Control','private, max-age=86400')
            self.end_headers()
            try:
                with open(full,'rb') as fh:
                    fh.seek(start)
                    remaining = length
                    while remaining > 0:
                        chunk = fh.read(min(256 * 1024, remaining))
                        if not chunk: break
                        self.wfile.write(chunk)
                        remaining -= len(chunk)
            except (BrokenPipeError, ConnectionResetError):
                pass
            return
        if p == '/api/health': return self.send_json({'ok':True,'version':'20.2','database':'sqlite-wal','write_protection':True})
        if p == '/api/me':
            u = auth_user(self.headers)
            return self.send_json({'user':u}, 200 if u else 401)
        if p == '/api/posts':
            u = self.require_user()
            if not u: return
            c=connect(); rows=c.execute('''SELECT p.*,u.name,u.role,u.avatar,
              (SELECT COUNT(*) FROM comments x WHERE x.post_id=p.id) comments,
              (SELECT COUNT(*) FROM likes l WHERE l.post_id=p.id) likes,
              EXISTS(SELECT 1 FROM likes l WHERE l.post_id=p.id AND l.user_id=?) liked,
              EXISTS(SELECT 1 FROM bookmarks b WHERE b.post_id=p.id AND b.user_id=?) bookmarked
              FROM posts p JOIN users u ON u.id=p.user_id
              WHERE p.status='published' ORDER BY p.is_featured DESC,p.id DESC''',(u['id'],u['id'])).fetchall()
            out=[]
            for r in rows:
                d=dict(r); d['answers']=[dict(x) for x in c.execute('''SELECT c.*,u.name,u.role,u.is_admin FROM comments c
                    JOIN users u ON u.id=c.user_id WHERE c.post_id=? ORDER BY c.is_solution DESC,c.id''',(r['id'],)).fetchall()]
                out.append(d)
            c.close(); return self.send_json(out)
        if p.startswith('/api/users/') and p.endswith('/profile'):
            u=self.require_user()
            if not u:return
            try: uid=int(p.split('/')[3])
            except:return self.send_json({'error':'Usuário inválido.'},400)
            c=connect(); row=c.execute("SELECT * FROM users WHERE id=? AND status='active'",(uid,)).fetchone()
            if not row: c.close(); return self.send_json({'error':'Profissional não encontrado.'},404)
            data=public_user(row)
            data['followers']=c.execute('SELECT COUNT(*) FROM follows WHERE followed_id=?',(uid,)).fetchone()[0]
            data['following']=c.execute('SELECT COUNT(*) FROM follows WHERE follower_id=?',(uid,)).fetchone()[0]
            data['posts']=c.execute("SELECT COUNT(*) FROM posts WHERE user_id=? AND status='published'",(uid,)).fetchone()[0]
            data['answers']=c.execute('SELECT COUNT(*) FROM comments WHERE user_id=?',(uid,)).fetchone()[0]
            data['is_following']=bool(c.execute('SELECT 1 FROM follows WHERE follower_id=? AND followed_id=?',(u['id'],uid)).fetchone())
            c.close(); return self.send_json(data)
        if p == '/api/users':
            if not self.require_user(): return
            c=connect(); rows=[]
            for x in c.execute("SELECT * FROM users WHERE status='active' ORDER BY is_admin DESC,name").fetchall():
                d=public_user(x)
                d['followers']=c.execute('SELECT COUNT(*) FROM follows WHERE followed_id=?',(x['id'],)).fetchone()[0]
                d['following']=c.execute('SELECT COUNT(*) FROM follows WHERE follower_id=?',(x['id'],)).fetchone()[0]
                d['is_following']=bool(c.execute('SELECT 1 FROM follows WHERE follower_id=? AND followed_id=?',(u['id'],x['id'])).fetchone()) if (u:=auth_user(self.headers)) else False
                rows.append(d)
            c.close(); return self.send_json(rows)
        if p == '/api/communities':
            u=self.require_user()
            if not u:return
            c=connect(); rows=[dict(x) for x in c.execute('''SELECT c.*,
             (SELECT COUNT(*) FROM community_members m WHERE m.community_id=c.id) members,
             EXISTS(SELECT 1 FROM community_members m WHERE m.community_id=c.id AND m.user_id=?) joined
             FROM communities c ORDER BY members DESC,c.name''',(u['id'],)).fetchall()]; c.close(); return self.send_json(rows)
        if p == '/api/notifications':
            u=self.require_user()
            if not u:return
            c=connect(); rows=[dict(x) for x in c.execute('''SELECT n.*,a.name actor_name FROM notifications n
              LEFT JOIN users a ON a.id=n.actor_id WHERE n.user_id=? ORDER BY n.id DESC LIMIT 50''',(u['id'],)).fetchall()]
            unread=c.execute('SELECT COUNT(*) FROM notifications WHERE user_id=? AND is_read=0',(u['id'],)).fetchone()[0]
            c.close(); return self.send_json({'items':rows,'unread':unread})
        if p == '/api/hire-requests':
            u=self.require_user()
            if not u:return
            c=connect(); rows=c.execute('''SELECT r.*,
              (SELECT COUNT(*) FROM service_request_matches m WHERE m.request_id=r.id) match_count
              FROM service_requests r WHERE r.requester_id=? ORDER BY r.id DESC''',(u['id'],)).fetchall()
            out=[]
            for row in rows:
                item=dict(row)
                item['matches']=[dict(x) for x in c.execute('''SELECT m.score,m.status,u.id,u.name,u.role,u.city,u.avatar,u.headline,u.company,u.specialties,u.equipment,u.availability,u.experience,u.completed_projects,u.response_time
                    FROM service_request_matches m JOIN users u ON u.id=m.professional_id
                    WHERE m.request_id=? AND u.status='active' ORDER BY m.score DESC,u.id''',(row['id'],)).fetchall()]
                out.append(item)
            c.close(); return self.send_json(out)
        if p == '/api/opportunities':
            u=self.require_user()
            if not u:return
            c=connect(); rows=[dict(x) for x in c.execute('''SELECT r.*,m.score,m.status match_status
              FROM service_request_matches m JOIN service_requests r ON r.id=m.request_id
              WHERE m.professional_id=? AND r.status='aberto' ORDER BY m.score DESC,r.id DESC''',(u['id'],)).fetchall()]
            c.close(); return self.send_json(rows)
        if p == '/api/quote-requests':
            u=self.require_user()
            if not u:return
            c=connect(); rows=[dict(x) for x in c.execute('''SELECT q.*,r.name requester_account FROM quote_requests q JOIN users r ON r.id=q.requester_id WHERE q.professional_id=? ORDER BY q.id DESC''',(u['id'],)).fetchall()]; c.close(); return self.send_json(rows)
        if p == '/api/knowledge':
            u=self.require_user()
            if not u:return
            c=connect(); rows=[dict(x) for x in c.execute('''SELECT a.*,u.name author_name,u.role author_role,u.avatar author_avatar,
              (a.author_id=? OR ?=1) can_manage FROM knowledge_articles a JOIN users u ON u.id=a.author_id
              WHERE a.status='published' ORDER BY a.is_featured DESC,a.id DESC''',(u['id'],u['is_admin'])).fetchall()]; c.close(); return self.send_json(rows)
        if p.startswith('/api/knowledge/'):
            u=self.require_user()
            if not u:return
            try: aid=int(p.split('/')[3])
            except:return self.send_json({'error':'Artigo inválido.'},400)
            c=connect(); row=c.execute('''SELECT a.*,u.name author_name,u.role author_role,u.avatar author_avatar,
              (a.author_id=? OR ?=1) can_manage FROM knowledge_articles a JOIN users u ON u.id=a.author_id WHERE a.id=? AND a.status='published' ''',(u['id'],u['is_admin'],aid)).fetchone()
            if row:c.execute('UPDATE knowledge_articles SET views=views+1 WHERE id=?',(aid,)); c.commit()
            c.close(); return self.send_json(dict(row) if row else {'error':'Artigo não encontrado.'},200 if row else 404)
        if p == '/api/marketplace':
            u=self.require_user()
            if not u:return
            c=connect(); rows=[dict(x) for x in c.execute('''SELECT m.*,u.name seller_name,u.avatar seller_avatar,u.city seller_city,
              (m.seller_id=?) can_manage FROM marketplace_listings m JOIN users u ON u.id=m.seller_id
              WHERE m.status='ativo' ORDER BY m.id DESC''',(u['id'],)).fetchall()]; c.close(); return self.send_json(rows)
        if p == '/api/marketplace/mine':
            u=self.require_user()
            if not u:return
            c=connect(); rows=[dict(x) for x in c.execute('''SELECT m.*,u.name seller_name,u.avatar seller_avatar,
              1 can_manage FROM marketplace_listings m JOIN users u ON u.id=m.seller_id
              WHERE m.seller_id=? ORDER BY m.id DESC''',(u['id'],)).fetchall()]; c.close(); return self.send_json(rows)
        if p == '/api/jobs':
            u=self.require_user()
            if not u:return
            c=connect(); rows=[dict(x) for x in c.execute('''SELECT j.*,u.name creator_name,u.avatar creator_avatar,co.name company_name,co.logo company_logo,
              (SELECT COUNT(*) FROM job_applications a WHERE a.job_id=j.id) applicants_count,
              EXISTS(SELECT 1 FROM job_applications a WHERE a.job_id=j.id AND a.user_id=?) applied,
              (j.creator_id=?) can_manage
              FROM jobs j JOIN users u ON u.id=j.creator_id LEFT JOIN companies co ON co.id=j.company_id
              WHERE j.status='aberta' ORDER BY j.id DESC''',(u['id'],u['id'])).fetchall()]; c.close(); return self.send_json(rows)
        if p == '/api/jobs/mine':
            u=self.require_user()
            if not u:return
            c=connect(); rows=[dict(x) for x in c.execute('''SELECT j.*,co.name company_name,
              (SELECT COUNT(*) FROM job_applications a WHERE a.job_id=j.id) applicants_count
              FROM jobs j LEFT JOIN companies co ON co.id=j.company_id WHERE j.creator_id=? ORDER BY j.id DESC''',(u['id'],)).fetchall()]; c.close(); return self.send_json(rows)
        if p.startswith('/api/jobs/') and p.endswith('/applications'):
            u=self.require_user()
            if not u:return
            try: jid=int(p.split('/')[3])
            except:return self.send_json({'error':'Vaga inválida.'},400)
            c=connect(); job=c.execute('SELECT creator_id,title FROM jobs WHERE id=?',(jid,)).fetchone()
            if not job: c.close(); return self.send_json({'error':'Vaga não encontrada.'},404)
            if job['creator_id']!=u['id'] and not u['is_admin']: c.close(); return self.send_json({'error':'Acesso restrito.'},403)
            rows=[dict(x) for x in c.execute('''SELECT a.*,us.name,us.role,us.city,us.avatar,us.headline,us.experience,us.specialties
              FROM job_applications a JOIN users us ON us.id=a.user_id WHERE a.job_id=? ORDER BY a.id DESC''',(jid,)).fetchall()]; c.close(); return self.send_json({'job_title':job['title'],'applications':rows})
        if p == '/api/companies':
            u=self.require_user()
            if not u:return
            c=connect(); rows=[dict(x) for x in c.execute('''SELECT co.*,u.name owner_name,
              (SELECT COUNT(*) FROM company_services s WHERE s.company_id=co.id) services_count,
              (SELECT COUNT(*) FROM company_projects p WHERE p.company_id=co.id) projects_count
              FROM companies co JOIN users u ON u.id=co.owner_id WHERE co.status='active' ORDER BY co.verified DESC,co.name''').fetchall()]
            c.close(); return self.send_json(rows)
        if p.startswith('/api/companies/'):
            u=self.require_user()
            if not u:return
            try: cid=int(p.split('/')[3])
            except:return self.send_json({'error':'Empresa inválida.'},400)
            c=connect(); row=c.execute("SELECT co.*,u.name owner_name FROM companies co JOIN users u ON u.id=co.owner_id WHERE co.id=? AND co.status='active'",(cid,)).fetchone()
            if not row: c.close(); return self.send_json({'error':'Empresa não encontrada.'},404)
            data=dict(row); data['can_edit']=bool(u['is_admin'] or u['id']==row['owner_id'])
            data['services']=[dict(x) for x in c.execute('SELECT * FROM company_services WHERE company_id=? ORDER BY id',(cid,)).fetchall()]
            data['team']=[dict(x) for x in c.execute('SELECT * FROM company_team WHERE company_id=? ORDER BY id',(cid,)).fetchall()]
            data['projects']=[dict(x) for x in c.execute('SELECT * FROM company_projects WHERE company_id=? ORDER BY id DESC',(cid,)).fetchall()]
            c.close(); return self.send_json(data)

        if p == '/api/audio-ai/history':
            u=self.require_user()
            if not u:return
            c=connect(); rows=[dict(x) for x in c.execute('''SELECT s.*, (SELECT COUNT(*) FROM audio_ai_messages m WHERE m.session_id=s.id) message_count FROM audio_ai_sessions s WHERE s.user_id=? ORDER BY s.updated_at DESC,s.id DESC LIMIT 50''',(u['id'],)).fetchall()]; c.close(); return self.send_json(rows)
        if p.startswith('/api/audio-ai/session/'):
            u=self.require_user()
            if not u:return
            try: sid=int(p.split('/')[4])
            except:return self.send_json({'error':'Conversa inválida.'},400)
            c=connect(); session=c.execute('SELECT * FROM audio_ai_sessions WHERE id=? AND user_id=?',(sid,u['id'])).fetchone()
            if not session:c.close();return self.send_json({'error':'Conversa não encontrada.'},404)
            messages=[dict(x) for x in c.execute('SELECT id,role,body,metadata,created_at FROM audio_ai_messages WHERE session_id=? ORDER BY id',(sid,)).fetchall()];c.close();return self.send_json({'session':dict(session),'messages':messages})
        if p == '/api/chat/conversations':
            u=self.require_user()
            if not u:return
            c=connect(); rows=c.execute('''SELECT cv.id,cv.updated_at,
              other.id other_user_id,other.name other_name,other.role other_role,other.avatar other_avatar,other.city other_city,
              (SELECT body FROM chat_messages mm WHERE mm.conversation_id=cv.id ORDER BY mm.id DESC LIMIT 1) last_body,
              (SELECT attachment_name FROM chat_messages mm WHERE mm.conversation_id=cv.id ORDER BY mm.id DESC LIMIT 1) last_attachment,
              (SELECT created_at FROM chat_messages mm WHERE mm.conversation_id=cv.id ORDER BY mm.id DESC LIMIT 1) last_at,
              (SELECT COUNT(*) FROM chat_messages mm WHERE mm.conversation_id=cv.id AND mm.sender_id<>? AND COALESCE(mm.read_at,'')='') unread
              FROM conversations cv
              JOIN conversation_members mine ON mine.conversation_id=cv.id AND mine.user_id=?
              JOIN conversation_members om ON om.conversation_id=cv.id AND om.user_id<>?
              JOIN users other ON other.id=om.user_id
              ORDER BY COALESCE(last_at,cv.updated_at) DESC''',(u['id'],u['id'],u['id'])).fetchall()
            out=[dict(x) for x in rows];c.close();return self.send_json(out)
        if p == '/api/chat/contacts':
            u=self.require_user()
            if not u:return
            q=(parse_qs(urlparse(self.path).query).get('q',[''])[0] or '').strip()
            like=f'%{q}%'
            c=connect()
            # Contas antigas podem ter status vazio/nulo. Nesse caso, tratamos como ativas.
            if q:
                rows=c.execute('''SELECT id,name,role,city,avatar,company,specialties,
                  CASE WHEN availability<>'' THEN availability ELSE 'Disponível para conversar' END availability
                  FROM users
                  WHERE COALESCE(NULLIF(status,''),'active')='active' AND id<>?
                  AND (name LIKE ? COLLATE NOCASE OR role LIKE ? COLLATE NOCASE OR city LIKE ? COLLATE NOCASE
                       OR company LIKE ? COLLATE NOCASE OR specialties LIKE ? COLLATE NOCASE)
                  ORDER BY CASE WHEN name LIKE ? COLLATE NOCASE THEN 0 ELSE 1 END,name LIMIT 50''',
                  (u['id'],like,like,like,like,like,like)).fetchall()
            else:
                rows=c.execute('''SELECT id,name,role,city,avatar,company,specialties,
                  CASE WHEN availability<>'' THEN availability ELSE 'Disponível para conversar' END availability
                  FROM users
                  WHERE COALESCE(NULLIF(status,''),'active')='active' AND id<>?
                  ORDER BY is_admin DESC,name LIMIT 50''',(u['id'],)).fetchall()
            out=[dict(x) for x in rows];c.close();return self.send_json(out)
        if p.startswith('/api/chat/conversations/') and p.endswith('/messages'):
            u=self.require_user()
            if not u:return
            try:cid=int(p.split('/')[4])
            except:return self.send_json({'error':'Conversa inválida.'},400)
            c=connect(); member=c.execute('SELECT 1 FROM conversation_members WHERE conversation_id=? AND user_id=?',(cid,u['id'])).fetchone()
            if not member:c.close();return self.send_json({'error':'Acesso restrito.'},403)
            rows=[dict(x) for x in c.execute('''SELECT m.*,us.name sender_name,us.avatar sender_avatar FROM chat_messages m JOIN users us ON us.id=m.sender_id WHERE m.conversation_id=? ORDER BY m.id''',(cid,)).fetchall()]
            c.execute("UPDATE chat_messages SET read_at=? WHERE conversation_id=? AND sender_id<>? AND COALESCE(read_at,'')=''",(now(),cid,u['id']));c.commit();c.close();return self.send_json(rows)
        if p == '/api/admin/stats':
            u=self.require_user()
            if not u:return
            if not u['is_admin']:return self.send_json({'error':'Acesso restrito.'},403)
            c=connect(); data={
                'users':c.execute('SELECT COUNT(*) FROM users').fetchone()[0],
                'posts':c.execute("SELECT COUNT(*) FROM posts WHERE status='published'").fetchone()[0],
                'comments':c.execute('SELECT COUNT(*) FROM comments').fetchone()[0],
                'communities':c.execute('SELECT COUNT(*) FROM communities').fetchone()[0]
            }; c.close(); return self.send_json(data)

        path = 'index.html' if p == '/' else p.lstrip('/')
        full = os.path.abspath(os.path.join(PUBLIC,path))
        if not full.startswith(os.path.abspath(PUBLIC)) or not os.path.isfile(full): full=os.path.join(PUBLIC,'index.html')
        data=open(full,'rb').read(); self.send_response(200); self.send_header('Content-Type',mimetypes.guess_type(full)[0] or 'application/octet-stream'); self.send_header('Content-Length',str(len(data))); self.end_headers(); self.wfile.write(data)

    def do_POST(self):
        p=urlparse(self.path).path
        if p == '/api/media/audio':
            u=self.require_user()
            if not u:return
            try:
                size=int(self.headers.get('Content-Length','0'))
            except ValueError:
                size=0
            media_type=(self.headers.get('Content-Type') or '').split(';',1)[0].strip().lower()
            raw_name=self.headers.get('X-File-Name','audio')
            try:
                from urllib.parse import unquote
                original_name=unquote(raw_name)[:220]
            except Exception:
                original_name='audio'
            limit=audio_limit_for(u)
            if size <= 0:
                return self.send_json({'error':'O arquivo de áudio está vazio.'},400)
            if size > limit:
                return self.send_json({'error':f'O áudio ultrapassa o limite do seu plano ({human_mb(limit)}).'},413)
            if media_type not in ALLOWED_AUDIO_TYPES:
                return self.send_json({'error':'Formato não permitido. Use MP3, WAV, OGG, M4A/AAC ou FLAC.'},415)
            filename=f"{datetime.now().strftime('%Y%m%d%H%M%S')}-{secrets.token_hex(8)}{ALLOWED_AUDIO_TYPES[media_type]}"
            final_path=os.path.join(AUDIO_DIR,filename)
            temp_path=final_path+'.part'
            remaining=size
            try:
                with open(temp_path,'wb') as fh:
                    while remaining>0:
                        chunk=self.rfile.read(min(1024*1024,remaining))
                        if not chunk: break
                        fh.write(chunk); remaining-=len(chunk)
                if remaining != 0:
                    try: os.remove(temp_path)
                    except OSError: pass
                    return self.send_json({'error':'O envio do áudio foi interrompido antes de terminar.'},400)
                os.replace(temp_path,final_path)
            except Exception as exc:
                try:
                    if os.path.exists(temp_path): os.remove(temp_path)
                except OSError: pass
                return self.send_json({'error':'Não foi possível salvar o áudio no computador.'},500)
            return self.send_json({'media_data':f'/media/audio/{filename}','media_type':media_type,'media_name':original_name,'size':size},201)
        if p == '/api/media/file':
            u=self.require_user()
            if not u:return
            try:size=int(self.headers.get('Content-Length','0'))
            except:size=0
            original_name=safe_original_filename(self.headers.get('X-File-Name','arquivo'))
            ext=os.path.splitext(original_name)[1].lower()
            if ext not in ALLOWED_FILE_EXTENSIONS:
                return self.send_json({'error':'Formato não permitido. Envie documentos, planilhas, apresentações, arquivos compactados ou arquivos técnicos de áudio.'},415)
            limit=file_limit_for(u,ext)
            if size<=0:return self.send_json({'error':'O arquivo está vazio.'},400)
            if size>limit:return self.send_json({'error':f'O arquivo ultrapassa o limite do seu plano ({human_mb(limit)}).'},413)
            media_type=(self.headers.get('X-File-Type') or mimetypes.guess_type(original_name)[0] or 'application/octet-stream')[:120]
            filename=f"{datetime.now().strftime('%Y%m%d%H%M%S')}-{secrets.token_hex(8)}{ext}"
            final_path=os.path.join(FILE_DIR,filename); temp_path=final_path+'.part'; remaining=size
            try:
                with open(temp_path,'wb') as fh:
                    while remaining>0:
                        chunk=self.rfile.read(min(1024*1024,remaining))
                        if not chunk:break
                        fh.write(chunk);remaining-=len(chunk)
                if remaining!=0:
                    try:os.remove(temp_path)
                    except OSError:pass
                    return self.send_json({'error':'O envio do arquivo foi interrompido antes de terminar.'},400)
                os.replace(temp_path,final_path)
            except Exception:
                try:
                    if os.path.exists(temp_path):os.remove(temp_path)
                except OSError:pass
                return self.send_json({'error':'Não foi possível salvar o arquivo no computador.'},500)
            return self.send_json({'media_data':f'/media/files/{filename}','media_type':media_type,'media_name':original_name,'size':size},201)
        d=self.read_json()
        if p == '/api/register':
            name=d.get('name','').strip(); email=d.get('email','').strip().lower(); password=d.get('password','')
            if len(name)<2 or '@' not in email or len(password)<6:return self.send_json({'error':'Preencha nome, e-mail válido e senha com pelo menos 6 caracteres.'},400)
            try:
                def create_user(c):
                    c.execute('''INSERT INTO users(name,email,password,role,city,bio,is_admin,status,created_at)
                        VALUES(?,?,?,?,?,'',0,'active',?)''',(name,email,password_hash(password),d.get('role','Estudante'),d.get('city',''),now()))
                    uid=c.execute('SELECT last_insert_rowid()').fetchone()[0]
                    return new_session(c,uid)
                token=write_transaction(create_user)
                return self.send_json({'token':token},201)
            except sqlite3.IntegrityError:
                return self.send_json({'error':'Este e-mail já está cadastrado. Use Entrar ou outro e-mail.'},409)
            except sqlite3.OperationalError as exc:
                print('[DB ERROR register]', exc)
                return self.send_json({'error':'O banco estava ocupado. Aguarde um instante e tente novamente.'},503)
        if p == '/api/login':
            c=connect(); row=c.execute("SELECT * FROM users WHERE email=? AND status='active'",(d.get('email','').strip().lower(),)).fetchone()
            if not row or not password_ok(d.get('password',''),row['password']): c.close(); return self.send_json({'error':'E-mail ou senha incorretos.'},401)
            if len(row['password'])<90: c.execute('UPDATE users SET password=? WHERE id=?',(password_hash(d.get('password','')),row['id']))
            token=new_session(c,row['id']); c.commit(); c.close(); return self.send_json({'token':token})
        u=self.require_user()
        if not u:return
        if p == '/api/logout':
            token=self.headers.get('Authorization','').replace('Bearer ','').strip(); c=connect(); c.execute('DELETE FROM sessions WHERE token=?',(token,)); c.commit(); c.close(); return self.send_json({'ok':True})
        if p == '/api/posts':
            title=d.get('title','').strip(); body=d.get('body','').strip()
            if len(title)<5 or len(body)<10:return self.send_json({'error':'Escreva um título e uma descrição mais completos.'},400)
            media=(d.get('media_data') or d.get('image_data') or '')
            media_type=(d.get('media_type') or ('image/jpeg' if str(media).startswith('data:image/') else ''))[:100]
            media_name=(d.get('media_name') or '')[:220]
            media_size=int(d.get('media_size') or 0)
            try:
                media, media_type, media_name = store_media_data(media, media_type, media_name, video_limit_for(u))
            except ValueError as exc:
                return self.send_json({'error':str(exc)},400)
            legacy_image=media if media_type.startswith('image/') else ''
            c=connect(); c.execute('''INSERT INTO posts(user_id,type,category,title,body,is_featured,status,image_data,media_data,media_type,media_name,media_size,link_url,created_at)
             VALUES(?,?,?,?,?,0,'published',?,?,?,?,?,?,?)''',(u['id'],d.get('type','Pergunta'),d.get('category','Geral'),title,body,legacy_image,media,media_type,media_name,media_size,valid_url(d.get('link_url','')),now())); c.commit(); c.close(); return self.send_json({'ok':True},201)
        if p.startswith('/api/posts/') and p.endswith('/edit'):
            try: pid=int(p.split('/')[3])
            except: return self.send_json({'error':'Publicação inválida.'},400)
            title=d.get('title','').strip(); body=d.get('body','').strip()
            if len(title)<5 or len(body)<10:return self.send_json({'error':'Escreva um título e uma descrição mais completos.'},400)
            c=connect(); post=c.execute("SELECT user_id,media_data,image_data FROM posts WHERE id=? AND status='published'",(pid,)).fetchone()
            if not post:
                c.close(); return self.send_json({'error':'Publicação não encontrada.'},404)
            if post['user_id']!=u['id'] and not u['is_admin']:
                c.close(); return self.send_json({'error':'Você só pode editar suas próprias publicações.'},403)
            media=d.get('media_data',None)
            if media is None and 'image_data' in d: media=d.get('image_data')
            if media is None:
                c.execute('''UPDATE posts SET type=?,category=?,title=?,body=?,link_url=?,updated_at=? WHERE id=?''',
                    (d.get('type','Pergunta'),d.get('category','Geral'),title,body,valid_url(d.get('link_url','')),now(),pid))
            else:
                media=media or ''
                media_type=(d.get('media_type') or ('image/jpeg' if str(media).startswith('data:image/') else ''))[:100]
                media_name=(d.get('media_name') or '')[:220]
                media_size=int(d.get('media_size') or 0)
                old_media=post['media_data'] or post['image_data'] or ''
                try:
                    media, media_type, media_name = store_media_data(media, media_type, media_name, video_limit_for(u))
                except ValueError as exc:
                    c.close(); return self.send_json({'error':str(exc)},400)
                legacy_image=media if media_type.startswith('image/') else ''
                c.execute('''UPDATE posts SET type=?,category=?,title=?,body=?,image_data=?,media_data=?,media_type=?,media_name=?,media_size=?,link_url=?,updated_at=? WHERE id=?''',
                    (d.get('type','Pergunta'),d.get('category','Geral'),title,body,legacy_image,media,media_type,media_name,media_size,valid_url(d.get('link_url','')),now(),pid))
                if old_media and old_media != media:
                    remove_media_file(old_media)
            c.commit(); c.close(); return self.send_json({'ok':True})
        if p.startswith('/api/posts/') and p.endswith('/comments'):
            try:pid=int(p.split('/')[3])
            except:return self.send_json({'error':'Publicação inválida.'},400)
            body=d.get('body','').strip()
            if len(body)<2:return self.send_json({'error':'Digite uma resposta.'},400)
            c=connect(); c.execute('INSERT INTO comments(post_id,user_id,body,is_solution,created_at) VALUES(?,?,?,0,?)',(pid,u['id'],body,now())); owner=c.execute('SELECT user_id,title FROM posts WHERE id=?',(pid,)).fetchone();
            if owner and owner['user_id']!=u['id']: c.execute("INSERT INTO notifications(user_id,actor_id,type,message,post_id,is_read,created_at) VALUES(?,?,'comment',?,?,0,?)",(owner['user_id'],u['id'],f"{u['name']} respondeu sua publicação: {owner['title']}",pid,now()))
            c.commit(); c.close(); return self.send_json({'ok':True},201)
        if p.startswith('/api/posts/') and p.endswith('/like'):
            pid=int(p.split('/')[3]); c=connect(); ex=c.execute('SELECT 1 FROM likes WHERE user_id=? AND post_id=?',(u['id'],pid)).fetchone()
            c.execute('DELETE FROM likes WHERE user_id=? AND post_id=?' if ex else 'INSERT INTO likes(user_id,post_id) VALUES(?,?)',(u['id'],pid));
            if not ex:
                owner=c.execute('SELECT user_id,title FROM posts WHERE id=?',(pid,)).fetchone()
                if owner and owner['user_id']!=u['id']: c.execute("INSERT INTO notifications(user_id,actor_id,type,message,post_id,is_read,created_at) VALUES(?,?,'like',?,?,0,?)",(owner['user_id'],u['id'],f"{u['name']} curtiu sua publicação: {owner['title']}",pid,now()))
            c.commit(); c.close(); return self.send_json({'liked':not bool(ex)})
        if p.startswith('/api/posts/') and p.endswith('/bookmark'):
            pid=int(p.split('/')[3]); c=connect(); ex=c.execute('SELECT 1 FROM bookmarks WHERE user_id=? AND post_id=?',(u['id'],pid)).fetchone()
            c.execute('DELETE FROM bookmarks WHERE user_id=? AND post_id=?' if ex else 'INSERT INTO bookmarks(user_id,post_id) VALUES(?,?)',(u['id'],pid)); c.commit(); c.close(); return self.send_json({'bookmarked':not bool(ex)})
        if p.startswith('/api/communities/') and p.endswith('/join'):
            cid=int(p.split('/')[3]); c=connect(); ex=c.execute('SELECT 1 FROM community_members WHERE community_id=? AND user_id=?',(cid,u['id'])).fetchone()
            c.execute('DELETE FROM community_members WHERE community_id=? AND user_id=?' if ex else 'INSERT INTO community_members(community_id,user_id,joined_at) VALUES(?,?,?)',(cid,u['id']) if ex else (cid,u['id'],now())); c.commit(); c.close(); return self.send_json({'joined':not bool(ex)})
        if p == '/api/hire-requests':
            message=d.get('message','').strip(); city=d.get('city','').strip(); event_type=d.get('event_type','').strip()
            if len(message)<10:return self.send_json({'error':'Descreva melhor o serviço que você precisa.'},400)
            if not city:return self.send_json({'error':'Informe a cidade do serviço.'},400)
            def normalize(value):
                import unicodedata
                return ''.join(ch for ch in unicodedata.normalize('NFD',(value or '').lower()) if unicodedata.category(ch)!='Mn')
            c=connect()
            c.execute('''INSERT INTO service_requests(requester_id,requester_name,requester_phone,city,event_date,event_type,audience,budget,equipment,message,status,created_at)
                VALUES(?,?,?,?,?,?,?,?,?,?,'aberto',?)''',(u['id'],d.get('requester_name',u['name']).strip(),d.get('requester_phone','').strip(),city,d.get('event_date','').strip(),event_type,d.get('audience','').strip(),d.get('budget','').strip(),d.get('equipment','').strip(),message,now()))
            rid=c.execute('SELECT last_insert_rowid()').fetchone()[0]
            target_text=normalize(' '.join([city,event_type,d.get('equipment',''),message]))
            professionals=c.execute("SELECT * FROM users WHERE status='active' AND id<>?",(u['id'],)).fetchall()
            ranked=[]
            for pro in professionals:
                score=10
                pro_city=normalize(pro['city'] or '')
                if pro_city and (pro_city in normalize(city) or normalize(city) in pro_city): score+=40
                region=normalize(pro['service_region'] if 'service_region' in pro.keys() else '')
                if region and any(w and w in region for w in normalize(city).split()): score+=15
                profile_text=normalize(' '.join([pro['role'] or '',pro['headline'] or '',pro['specialties'] or '',pro['services'] or '',pro['equipment'] or '',pro['bio'] or '']))
                words={w for w in target_text.replace('/',' ').replace(',',' ').split() if len(w)>3}
                score+=min(35,sum(5 for w in words if w in profile_text))
                if normalize(d.get('equipment','')) and normalize(d.get('equipment','')) in profile_text: score+=20
                if 'indisponivel' in normalize(pro['availability'] or ''): score-=30
                ranked.append((max(0,min(score,100)),pro))
            ranked.sort(key=lambda x:(-x[0],x[1]['id']))
            selected=[x for x in ranked if x[0]>=15][:6]
            if not selected: selected=ranked[:6]
            for score,pro in selected:
                c.execute("INSERT OR IGNORE INTO service_request_matches(request_id,professional_id,score,status,created_at) VALUES(?,?,?,'recomendado',?)",(rid,pro['id'],score,now()))
                c.execute("INSERT INTO notifications(user_id,actor_id,type,message,is_read,created_at) VALUES(?,?,'opportunity',?,0,?)",(pro['id'],u['id'],f"Nova oportunidade em {city}: {event_type or 'serviço de áudio'}",now()))
            c.commit()
            matches=[dict(x) for x in c.execute('''SELECT m.score,u.id,u.name,u.role,u.city,u.avatar,u.headline,u.company,u.specialties,u.equipment,u.availability,u.experience,u.completed_projects,u.response_time
                FROM service_request_matches m JOIN users u ON u.id=m.professional_id WHERE m.request_id=? ORDER BY m.score DESC''',(rid,)).fetchall()]
            c.close(); return self.send_json({'ok':True,'request_id':rid,'matches':matches},201)
        if p.startswith('/api/users/') and p.endswith('/quote'):
            try:uid=int(p.split('/')[3])
            except:return self.send_json({'error':'Profissional inválido.'},400)
            message=d.get('message','').strip()
            if len(message)<10:return self.send_json({'error':'Descreva melhor o serviço desejado.'},400)
            c=connect(); target=c.execute("SELECT id,name FROM users WHERE id=? AND status='active'",(uid,)).fetchone()
            if not target: c.close(); return self.send_json({'error':'Profissional não encontrado.'},404)
            c.execute('''INSERT INTO quote_requests(professional_id,requester_id,requester_name,requester_phone,city,event_date,event_type,audience,message,status,created_at) VALUES(?,?,?,?,?,?,?,?,?,'novo',?)''',(uid,u['id'],d.get('requester_name',u['name']).strip(),d.get('requester_phone','').strip(),d.get('city','').strip(),d.get('event_date','').strip(),d.get('event_type','').strip(),d.get('audience','').strip(),message,now()))
            c.execute("INSERT INTO notifications(user_id,actor_id,type,message,is_read,created_at) VALUES(?,?,'quote',?,0,?)",(uid,u['id'],f"{u['name']} enviou uma solicitação de orçamento.",now()))
            c.commit(); c.close(); return self.send_json({'ok':True},201)
        if p == '/api/marketplace':
            title=(d.get('title') or '').strip(); desc=(d.get('description') or '').strip()
            if len(title)<4 or len(desc)<10:return self.send_json({'error':'Informe título e descrição completos.'},400)
            def create_listing(c):
                c.execute('''INSERT INTO marketplace_listings(seller_id,title,category,listing_type,price,item_condition,city,description,contact_phone,image_data,status,created_at,updated_at)
                  VALUES(?,?,?,?,?,?,?,?,?,?,'ativo',?,?)''',(u['id'],title,(d.get('category') or 'Outros')[:80],(d.get('listing_type') or 'Venda')[:30],(d.get('price') or '')[:80],(d.get('item_condition') or 'Usado')[:40],(d.get('city') or u.get('city') or '')[:120],desc[:4000],(d.get('contact_phone') or u.get('whatsapp') or '')[:40],(d.get('image_data') or '')[:4000000],now(),now()))
                return c.execute('SELECT last_insert_rowid()').fetchone()[0]
            lid=write_transaction(create_listing); return self.send_json({'ok':True,'id':lid},201)
        if p.startswith('/api/marketplace/') and p.endswith('/close'):
            try: lid=int(p.split('/')[3])
            except:return self.send_json({'error':'Anúncio inválido.'},400)
            def close_listing(c):
                row=c.execute('SELECT seller_id FROM marketplace_listings WHERE id=?',(lid,)).fetchone()
                if not row:return 'missing'
                if row['seller_id']!=u['id'] and not u['is_admin']:return 'forbidden'
                c.execute("UPDATE marketplace_listings SET status='encerrado',updated_at=? WHERE id=?",(now(),lid)); return 'ok'
            result=write_transaction(close_listing)
            if result=='missing':return self.send_json({'error':'Anúncio não encontrado.'},404)
            if result=='forbidden':return self.send_json({'error':'Acesso restrito.'},403)
            return self.send_json({'ok':True})
        if p == '/api/jobs':
            title=d.get('title','').strip(); description=d.get('description','').strip()
            if len(title)<5:return self.send_json({'error':'Informe um título mais claro para a vaga.'},400)
            if len(description)<15:return self.send_json({'error':'Descreva melhor a oportunidade.'},400)
            c=connect(); company=c.execute('SELECT id FROM companies WHERE owner_id=?',(u['id'],)).fetchone()
            cid=company['id'] if company and d.get('use_company',True) else None
            c.execute('''INSERT INTO jobs(creator_id,company_id,title,category,city,work_mode,contract_type,event_date,compensation,description,requirements,contact_phone,status,created_at,updated_at)
              VALUES(?,?,?,?,?,?,?,?,?,?,?,?,'aberta',?,?)''',(u['id'],cid,title,d.get('category','Áudio ao vivo').strip(),d.get('city','').strip(),d.get('work_mode','Presencial').strip(),d.get('contract_type','Freelancer').strip(),d.get('event_date','').strip(),d.get('compensation','').strip(),description,d.get('requirements','').strip(),d.get('contact_phone','').strip(),now(),now()))
            jid=c.execute('SELECT last_insert_rowid()').fetchone()[0]
            c.commit(); c.close(); return self.send_json({'ok':True,'id':jid},201)
        if p.startswith('/api/jobs/') and p.endswith('/apply'):
            try: jid=int(p.split('/')[3])
            except:return self.send_json({'error':'Vaga inválida.'},400)
            message=d.get('message','').strip()
            if len(message)<10:return self.send_json({'error':'Escreva uma breve apresentação.'},400)
            c=connect(); job=c.execute("SELECT * FROM jobs WHERE id=? AND status='aberta'",(jid,)).fetchone()
            if not job: c.close(); return self.send_json({'error':'Esta vaga não está disponível.'},404)
            if job['creator_id']==u['id']: c.close(); return self.send_json({'error':'Você não pode se candidatar à própria vaga.'},400)
            try:
                c.execute("INSERT INTO job_applications(job_id,user_id,message,phone,status,created_at) VALUES(?,?,?,?,'enviada',?)",(jid,u['id'],message,d.get('phone','').strip(),now()))
            except sqlite3.IntegrityError:
                c.close(); return self.send_json({'error':'Você já se candidatou a esta vaga.'},409)
            c.execute("INSERT INTO notifications(user_id,actor_id,type,message,is_read,created_at) VALUES(?,?,'job',?,0,?)",(job['creator_id'],u['id'],f"{u['name']} se candidatou à vaga {job['title']}.",now()))
            c.commit(); c.close(); return self.send_json({'ok':True},201)
        if p.startswith('/api/job-applications/') and p.endswith('/status'):
            try: aid=int(p.split('/')[3])
            except:return self.send_json({'error':'Candidatura inválida.'},400)
            status=d.get('status','').strip()
            if status not in ('em análise','aprovada','recusada'):return self.send_json({'error':'Status inválido.'},400)
            c=connect(); row=c.execute('''SELECT a.id,a.user_id,j.creator_id,j.title FROM job_applications a JOIN jobs j ON j.id=a.job_id WHERE a.id=?''',(aid,)).fetchone()
            if not row: c.close(); return self.send_json({'error':'Candidatura não encontrada.'},404)
            if row['creator_id']!=u['id'] and not u['is_admin']: c.close(); return self.send_json({'error':'Acesso restrito.'},403)
            c.execute('UPDATE job_applications SET status=? WHERE id=?',(status,aid))
            c.execute("INSERT INTO notifications(user_id,actor_id,type,message,is_read,created_at) VALUES(?,?,'job_status',?,0,?)",(row['user_id'],u['id'],f"Sua candidatura para {row['title']} foi atualizada para: {status}.",now()))
            c.commit(); c.close(); return self.send_json({'ok':True})
        if p.startswith('/api/jobs/') and p.endswith('/close'):
            try: jid=int(p.split('/')[3])
            except:return self.send_json({'error':'Vaga inválida.'},400)
            c=connect(); row=c.execute('SELECT creator_id FROM jobs WHERE id=?',(jid,)).fetchone()
            if not row: c.close(); return self.send_json({'error':'Vaga não encontrada.'},404)
            if row['creator_id']!=u['id'] and not u['is_admin']: c.close(); return self.send_json({'error':'Acesso restrito.'},403)
            c.execute("UPDATE jobs SET status='encerrada',updated_at=? WHERE id=?",(now(),jid)); c.commit(); c.close(); return self.send_json({'ok':True})
        if p.startswith('/api/admin/users/') and p.endswith('/plan'):
            if not u.get('is_admin'):
                return self.send_json({'error':'Acesso restrito ao administrador.'},403)
            try: uid=int(p.split('/')[4])
            except Exception: return self.send_json({'error':'Usuário inválido.'},400)
            plan=(d.get('plan') or '').lower()
            if plan not in ('free','pro','company','admin'):
                return self.send_json({'error':'Plano inválido.'},400)
            def set_plan(c):
                row=c.execute('SELECT id,is_admin FROM users WHERE id=?',(uid,)).fetchone()
                if not row:return False
                c.execute('UPDATE users SET plan=? WHERE id=?',(plan,uid))
                return True
            if not write_transaction(set_plan):return self.send_json({'error':'Usuário não encontrado.'},404)
            return self.send_json({'ok':True,'plan':plan,'limit':PLAN_LIMITS[plan]})
        if p == '/api/companies':
            name=d.get('name','').strip()
            if len(name)<2:return self.send_json({'error':'Informe o nome da empresa.'},400)
            def save_company(c):
                existing=c.execute('SELECT id FROM companies WHERE owner_id=?',(u['id'],)).fetchone()
                values=(name,d.get('category','').strip(),d.get('tagline','').strip(),d.get('description','').strip(),d.get('city','').strip(),d.get('service_region','').strip(),d.get('phone','').strip(),d.get('whatsapp','').strip(),d.get('email','').strip(),d.get('instagram','').strip(),d.get('website','').strip(),d.get('logo','')[:1200000],d.get('cover','')[:1800000],now())
                if existing:
                    cid=existing['id']; c.execute('''UPDATE companies SET name=?,category=?,tagline=?,description=?,city=?,service_region=?,phone=?,whatsapp=?,email=?,instagram=?,website=?,logo=?,cover=?,updated_at=? WHERE id=?''',values+(cid,))
                else:
                    c.execute('''INSERT INTO companies(owner_id,name,category,tagline,description,city,service_region,phone,whatsapp,email,instagram,website,logo,cover,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,'active',?,?)''',(u['id'],)+values[:-1]+(now(),now()))
                    cid=c.execute('SELECT last_insert_rowid()').fetchone()[0]
                c.execute('DELETE FROM company_services WHERE company_id=?',(cid,)); c.execute('DELETE FROM company_team WHERE company_id=?',(cid,)); c.execute('DELETE FROM company_projects WHERE company_id=?',(cid,))
                for item in d.get('services',[])[:20]:
                    title=str(item.get('title','')).strip()
                    if title:c.execute('INSERT INTO company_services(company_id,title,description,icon) VALUES(?,?,?,?)',(cid,title,str(item.get('description','')).strip(),str(item.get('icon','🎚️'))[:8]))
                for item in d.get('team',[])[:20]:
                    name2=str(item.get('name','')).strip()
                    if name2:c.execute('INSERT INTO company_team(company_id,name,role,bio,photo) VALUES(?,?,?,?,?)',(cid,name2,str(item.get('role','')).strip(),str(item.get('bio','')).strip(),str(item.get('photo',''))[:1200000]))
                for item in d.get('projects',[])[:30]:
                    title=str(item.get('title','')).strip()
                    if title:c.execute('INSERT INTO company_projects(company_id,title,description,image,link_url) VALUES(?,?,?,?,?)',(cid,title,str(item.get('description','')).strip(),str(item.get('image',''))[:1200000],valid_url(item.get('link_url',''))))
                return cid
            try: cid=write_transaction(save_company)
            except sqlite3.IntegrityError:return self.send_json({'error':'Já existe uma empresa com esse nome.'},409)
            return self.send_json({'ok':True,'id':cid},201)

        if p == '/api/audio-ai/ask':
            question=d.get('question','').strip(); mode=d.get('mode','Pergunta técnica').strip(); symptom=d.get('symptom','').strip(); context=d.get('context','').strip()
            if len(question)<3 and len(symptom)<3:return self.send_json({'error':'Descreva sua dúvida ou selecione um sintoma.'},400)
            sid=d.get('session_id')
            c=connect()
            if sid:
                session=c.execute('SELECT id FROM audio_ai_sessions WHERE id=? AND user_id=?',(sid,u['id'])).fetchone()
                if not session:c.close();return self.send_json({'error':'Conversa inválida.'},403)
                sid=int(sid)
            else:
                title=(question or symptom or 'Nova conversa')[:70]
                c.execute('INSERT INTO audio_ai_sessions(user_id,title,mode,created_at,updated_at) VALUES(?,?,?,?,?)',(u['id'],title,mode,now(),now())); sid=c.execute('SELECT last_insert_rowid()').fetchone()[0]
            meta=json.dumps({'mode':mode,'symptom':symptom,'context':context,'attachment_name':d.get('attachment_name','')[:200],'attachment_type':d.get('attachment_type','')[:100],'attachment_size':int(d.get('attachment_size') or 0)},ensure_ascii=False)
            user_body=question or ('Diagnóstico: '+symptom)
            c.execute("INSERT INTO audio_ai_messages(session_id,user_id,role,body,metadata,created_at) VALUES(?,?,'user',?,?,?)",(sid,u['id'],user_body,meta,now()))
            answer=audio_ai_answer(question,mode,symptom,context)
            article_terms=' '.join([question,symptom]).lower().split()[:8]
            articles=[]
            if article_terms:
                clauses=' OR '.join(['lower(title||\' \'||summary||\' \'||body) LIKE ?']*len(article_terms))
                params=['%'+x+'%' for x in article_terms if len(x)>2]
                if params:
                    clauses=' OR '.join(['lower(title||\' \'||summary||\' \'||body) LIKE ?']*len(params))
                    articles=[dict(x) for x in c.execute(f"SELECT id,title,category FROM knowledge_articles WHERE status='published' AND ({clauses}) ORDER BY is_featured DESC,views DESC LIMIT 3",params).fetchall()]
            answer['related_articles']=articles
            body=json.dumps(answer,ensure_ascii=False)
            c.execute("INSERT INTO audio_ai_messages(session_id,user_id,role,body,metadata,created_at) VALUES(?,?,'assistant',?,'',?)",(sid,u['id'],body,now()))
            c.execute('UPDATE audio_ai_sessions SET updated_at=?,mode=? WHERE id=?',(now(),mode,sid));c.commit();c.close();return self.send_json({'ok':True,'session_id':sid,'answer':answer},201)
        if p.startswith('/api/audio-ai/session/') and p.endswith('/delete'):
            try:sid=int(p.split('/')[4])
            except:return self.send_json({'error':'Conversa inválida.'},400)
            c=connect();c.execute('DELETE FROM audio_ai_sessions WHERE id=? AND user_id=?',(sid,u['id']));c.commit();c.close();return self.send_json({'ok':True})
        if p == '/api/chat/demo-user':
            u=self.require_user()
            if not u:return
            if not u.get('is_admin'):
                return self.send_json({'error':'Somente o administrador pode criar a conta de teste.'},403)
            def create_demo(c):
                email='tecnico.teste@sociaudio.local'
                row=c.execute('SELECT id,name,email,role,city,avatar,company,specialties FROM users WHERE email=?',(email,)).fetchone()
                if row:
                    c.execute("UPDATE users SET status='active' WHERE id=?",(row['id'],))
                    return dict(row)
                c.execute('''INSERT INTO users(name,email,password,role,city,bio,specialties,experience,equipment,is_admin,status,created_at,company,availability)
                  VALUES(?,?,?,?,?,?,?,?,?,0,'active',?,?,?)''',
                  ('Técnico de Teste',email,password_hash('123456'),'Operador de Áudio','Joinville - SC',
                   'Conta de demonstração para testar mensagens e recursos da Rede Sociaudio.',
                   'Mixagem ao vivo, Igrejas, Mesas digitais','5 anos','Ui24R, X32',now(),'Rede Sociaudio','Disponível para conversar'))
                uid=c.execute('SELECT last_insert_rowid()').fetchone()[0]
                return {'id':uid,'name':'Técnico de Teste','email':email,'role':'Operador de Áudio','city':'Joinville - SC','avatar':'','company':'Rede Sociaudio','specialties':'Mixagem ao vivo, Igrejas, Mesas digitais'}
            user=write_transaction(create_demo)
            return self.send_json({'ok':True,'user':user,'password':'123456'},201)
        if p == '/api/chat/conversations':
            u=self.require_user()
            if not u:return
            other_id=int(d.get('user_id') or 0)
            if not other_id or other_id==u['id']:return self.send_json({'error':'Selecione outro usuário.'},400)
            def create_conv(c):
                other=c.execute("SELECT id FROM users WHERE id=? AND status='active'",(other_id,)).fetchone()
                if not other:raise ValueError('Usuário não encontrado.')
                existing=c.execute('''SELECT cm1.conversation_id FROM conversation_members cm1 JOIN conversation_members cm2 ON cm2.conversation_id=cm1.conversation_id WHERE cm1.user_id=? AND cm2.user_id=? AND (SELECT COUNT(*) FROM conversation_members x WHERE x.conversation_id=cm1.conversation_id)=2 LIMIT 1''',(u['id'],other_id)).fetchone()
                if existing:return existing[0]
                stamp=now();c.execute('INSERT INTO conversations(created_at,updated_at) VALUES(?,?)',(stamp,stamp));cid=c.execute('SELECT last_insert_rowid()').fetchone()[0]
                c.executemany('INSERT INTO conversation_members(conversation_id,user_id,joined_at) VALUES(?,?,?)',[(cid,u['id'],stamp),(cid,other_id,stamp)])
                return cid
            try:cid=write_transaction(create_conv)
            except ValueError as e:return self.send_json({'error':str(e)},404)
            return self.send_json({'id':cid},201)
        if p.startswith('/api/chat/conversations/') and p.endswith('/messages'):
            u=self.require_user()
            if not u:return
            try:cid=int(p.split('/')[4])
            except:return self.send_json({'error':'Conversa inválida.'},400)
            body=(d.get('body') or '').strip()[:5000];url=(d.get('attachment_url') or '').strip()[:2000];name=(d.get('attachment_name') or '').strip()[:220];atype=(d.get('attachment_type') or '').strip()[:120];asize=int(d.get('attachment_size') or 0)
            if not body and not url:return self.send_json({'error':'Digite uma mensagem ou anexe um arquivo.'},400)
            def send_msg(c):
                member=c.execute('SELECT 1 FROM conversation_members WHERE conversation_id=? AND user_id=?',(cid,u['id'])).fetchone()
                if not member:raise PermissionError()
                stamp=now();c.execute('''INSERT INTO chat_messages(conversation_id,sender_id,body,attachment_url,attachment_name,attachment_type,attachment_size,created_at) VALUES(?,?,?,?,?,?,?,?)''',(cid,u['id'],body,url,name,atype,asize,stamp));mid=c.execute('SELECT last_insert_rowid()').fetchone()[0];c.execute('UPDATE conversations SET updated_at=? WHERE id=?',(stamp,cid));return mid
            try:mid=write_transaction(send_msg)
            except PermissionError:return self.send_json({'error':'Acesso restrito.'},403)
            return self.send_json({'id':mid},201)
        if p == '/api/profile':
            c=connect(); c.execute('''UPDATE users SET name=?,role=?,city=?,bio=?,specialties=?,experience=?,equipment=?,avatar=?,cover=?,services=?,certifications=?,service_region=?,whatsapp=?,instagram=?,website=?,availability=?,headline=?,company=?,response_time=?,completed_projects=?,portfolio_links=?,work_history=? WHERE id=?''',
              (d.get('name','').strip(),d.get('role','').strip(),d.get('city','').strip(),d.get('bio','').strip(),d.get('specialties','').strip(),d.get('experience','').strip(),d.get('equipment','').strip(),d.get('avatar','')[:1200000],d.get('cover','')[:1800000],d.get('services','').strip(),d.get('certifications','').strip(),d.get('service_region','').strip(),d.get('whatsapp','').strip(),d.get('instagram','').strip(),d.get('website','').strip(),d.get('availability','').strip(),d.get('headline','').strip(),d.get('company','').strip(),d.get('response_time','').strip(),d.get('completed_projects','').strip(),d.get('portfolio_links','').strip(),d.get('work_history','').strip(),u['id'])); c.commit(); c.close(); return self.send_json({'ok':True})
        if p.startswith('/api/users/') and p.endswith('/follow'):
            try:uid=int(p.split('/')[3])
            except:return self.send_json({'error':'Usuário inválido.'},400)
            if uid==u['id']:return self.send_json({'error':'Você não pode seguir a si mesmo.'},400)
            c=connect(); ex=c.execute('SELECT 1 FROM follows WHERE follower_id=? AND followed_id=?',(u['id'],uid)).fetchone()
            if ex: c.execute('DELETE FROM follows WHERE follower_id=? AND followed_id=?',(u['id'],uid))
            else:
                c.execute('INSERT INTO follows(follower_id,followed_id,created_at) VALUES(?,?,?)',(u['id'],uid,now()))
                c.execute("INSERT INTO notifications(user_id,actor_id,type,message,is_read,created_at) VALUES(?,?,'follow',?,0,?)",(uid,u['id'],f"{u['name']} começou a seguir você.",now()))
            c.commit(); c.close(); return self.send_json({'following':not bool(ex)})
        if p == '/api/notifications/read':
            c=connect(); c.execute('UPDATE notifications SET is_read=1 WHERE user_id=?',(u['id'],)); c.commit(); c.close(); return self.send_json({'ok':True})
        if p.startswith('/api/admin/posts/') and p.endswith('/feature'):
            if not u['is_admin']:return self.send_json({'error':'Acesso restrito.'},403)
            pid=int(p.split('/')[4]); c=connect(); c.execute('UPDATE posts SET is_featured=CASE is_featured WHEN 1 THEN 0 ELSE 1 END WHERE id=?',(pid,)); c.commit(); c.close(); return self.send_json({'ok':True})
        return self.send_json({'error':'Rota não encontrada.'},404)

    def do_DELETE(self):
        p=urlparse(self.path).path; u=self.require_user()
        if not u:return
        if p.startswith('/api/posts/'):
            try: pid=int(p.split('/')[3])
            except Exception:return self.send_json({'error':'Publicação inválida.'},400)
            c=connect(); post=c.execute("SELECT user_id,media_data,image_data FROM posts WHERE id=? AND status='published'",(pid,)).fetchone()
            if not post:
                c.close(); return self.send_json({'error':'Publicação não encontrada.'},404)
            if post['user_id']!=u['id'] and not u['is_admin']:
                c.close(); return self.send_json({'error':'Você só pode excluir suas próprias publicações.'},403)
            media=post['media_data'] or post['image_data'] or ''
            c.execute('DELETE FROM posts WHERE id=?',(pid,)); c.commit(); c.close()
            remove_media_file(media)
            return self.send_json({'ok':True})
        if p.startswith('/api/admin/posts/'):
            if not u['is_admin']:return self.send_json({'error':'Acesso restrito.'},403)
            try: pid=int(p.split('/')[4])
            except Exception:return self.send_json({'error':'Publicação inválida.'},400)
            c=connect(); post=c.execute('SELECT media_data,image_data FROM posts WHERE id=?',(pid,)).fetchone()
            media=(post['media_data'] or post['image_data'] or '') if post else ''
            c.execute('DELETE FROM posts WHERE id=?',(pid,)); c.commit(); c.close(); remove_media_file(media)
            return self.send_json({'ok':True})
        return self.send_json({'error':'Rota não encontrada.'},404)



if __name__ == '__main__':
    prepare_persistent_storage()
    init_db()
    url=f'http://{HOST}:{PORT}'
    print('\n=========================================')
    print(' REDE SOCIAUDIO V19.2 INICIADA COM SUCESSO')
    print(' Abra no navegador:',url)
    print(' Dados permanentes em:', DATA_ROOT)
    print(' Para encerrar, pressione CTRL+C')
    print('=========================================\n')
    try: webbrowser.open(url)
    except: pass
    SociaudioServer((HOST,PORT),Handler).serve_forever()
