import os
import json
from pathlib import Path

# Defina o caminho para a pasta do seu cofre do Obsidian no WSL
# Exemplo apontando para o HD H:\ ou para o caminho do Windows via /mnt/
OBSIDIAN_VAULT_PATH = "H:\OBSIDIAN_VAULT"
OUTPUT_JSONL = "/mnt/h/MeusModelosAI/dataset_obsidian.jsonl"

def parse_markdown_to_records(vault_path):
    records = []
    vault_dir = Path(vault_path)
    
    # Percorre todas as pastas e arquivos .md recursivamente
    for md_file in vault_dir.glob("**/*.md"):
        try:
            with open(md_file, "r", encoding="utf-8") as f:
                content = f.read()
                
            if not content.strip():
                continue
                
            # Usamos o nome do arquivo como o tópico/instrução e o conteúdo como a resposta/contexto
            title = md_file.stem.replace("-", " ").replace("_", " ")
            
            # Estrutura JSON padrão para fine-tuning ou RAG
            record = {
                "instruction": f"Explique ou consulte as diretrizes sobre: {title}",
                "context": f"Origem: {md_file.name}",
                "output": content.strip()
            }
            records.append(record)
        except Exception as e:
            print(f"Erro ao ler o arquivo {md_file.name}: {e}")
            
    return records

def save_to_jsonl(records, output_path):
    # Garante que o diretório de saída existe
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    with open(output_path, "w", encoding="utf-8") as f:
        for record in records:
            f.write(json.dumps(record, ensure_ascii=False) + "\n")
            
    print(f"Sucesso! {len(records)} notas convertidas e salvas em: {output_path}")

if __name__ == "__main__":
    if not os.path.exists(OBSIDIAN_VAULT_PATH):
        print(f"Caminho do cofre não encontrado: {OBSIDIAN_VAULT_PATH}")
    else:
        print("A processar notas do Obsidian...")
        dados = parse_markdown_to_records(OBSIDIAN_VAULT_PATH)
        save_to_jsonl(dados, OUTPUT_JSONL)