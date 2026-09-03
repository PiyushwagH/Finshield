import sys
from pathlib import Path
import logging

# Setup paths for importing app modules
base_dir = Path(__file__).resolve().parent.parent
sys.path.append(str(base_dir))

from app.database import SessionLocal
from app.services.scheme_sync import sync_schemes, JSONSchemeSource

logging.basicConfig(level=logging.INFO)

def main():
    db = SessionLocal()
    try:
        source = JSONSchemeSource(str(base_dir / 'seeds' / 'schemes.json'))
        sync_schemes(db, source)
    finally:
        db.close()

if __name__ == "__main__":
    main()
