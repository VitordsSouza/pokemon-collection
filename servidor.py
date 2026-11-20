"""Servidor local do projeto, sem cache.

O "python -m http.server" deixa o navegador reaproveitar HTML, CSS e JS antigos,
então uma alteração só aparecia depois de Ctrl+Shift+R. Este servidor manda o
navegador buscar sempre a versão atual dos arquivos.

Uso, na pasta do projeto:  python servidor.py
Depois abra:               http://localhost:5500
"""

from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

PORTA = 5500


class SemCache(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


if __name__ == "__main__":
    pasta = Path(__file__).resolve().parent
    # Só este computador acessa (o http.server padrão fica visível para a rede local).
    servidor = ThreadingHTTPServer(("localhost", PORTA), partial(SemCache, directory=pasta))
    print(f"Coleção em http://localhost:{PORTA}  (Ctrl+C para parar)")
    try:
        servidor.serve_forever()
    except KeyboardInterrupt:
        print("\nServidor parado.")
