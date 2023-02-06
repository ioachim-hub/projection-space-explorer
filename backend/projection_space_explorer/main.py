from flask import Flask
from .projection_space_explorer import pse_api
from flask_cors import CORS

def create_app():
    app = Flask(__name__)
    CORS(app)
    app.register_blueprint(pse_api)
    return app

if __name__ == "__main__":
    create_app()