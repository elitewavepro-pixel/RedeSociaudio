import os, shutil, sqlite3
from tkinter import Tk, filedialog, messagebox

root = Tk(); root.withdraw()
source = filedialog.askopenfilename(
    title='Selecione o arquivo sociaudio.db de uma versão anterior',
    filetypes=[('Banco Rede Sociaudio', 'sociaudio.db'), ('Banco SQLite', '*.db'), ('Todos os arquivos', '*.*')]
)
if not source:
    raise SystemExit
try:
    c=sqlite3.connect(source); c.execute('PRAGMA schema_version').fetchone(); c.close()
except Exception as exc:
    messagebox.showerror('Rede Sociaudio', f'O arquivo selecionado não é um banco válido.\n\n{exc}')
    raise SystemExit(1)
base=os.environ.get('LOCALAPPDATA') or os.path.join(os.path.expanduser('~'),'.local','share')
dest_dir=os.path.join(base,'RedeSociaudio','data')
os.makedirs(dest_dir,exist_ok=True)
dest=os.path.join(dest_dir,'sociaudio.db')
if os.path.exists(dest):
    backup=dest+'.antes-da-importacao.bak'
    shutil.copy2(dest,backup)
shutil.copy2(source,dest)
messagebox.showinfo('Rede Sociaudio','Dados importados com sucesso. Agora abra a Rede Sociaudio V9.')
