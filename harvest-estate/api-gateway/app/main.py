from __future__ import annotations

from flask import Flask

from .config import load_config
from .db import init_engine, remove_session
from .routes import bp as sovereign_bp


def create_app() -> Flask:
    app = Flask(__name__)

    config = load_config()
    app.config["ESTATE_CONFIG"] = config

    init_engine(config.database_url)

    @app.teardown_appcontext
    def cleanup(_exception: Exception | None):
        remove_session()

    app.register_blueprint(sovereign_bp)

    return app
