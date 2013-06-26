#!/usr/bin/python
from flask import Flask
app = Flask(__name__)

import web_interface.views
from views import Frontend

from i2c_raspberry import RgbCoordinator, RgbController, RgbLed, RgbLedSet, HttpError
