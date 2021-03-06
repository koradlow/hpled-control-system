	#!/usr/bin/python
import random

import signal

import gevent
import gevent.monkey
from gevent.queue import Queue
from gevent.pywsgi import WSGIServer
gevent.monkey.patch_all()

import threading

from pprint import pprint

from web_interface import app
from flask import request, Response, render_template
from flask import make_response, url_for, abort, current_app
from flask.views import MethodView

from flask.ext.jsonpify import jsonify

from i2c_raspberry import *


@app.route('/index')
@app.route('/')
def render_website():
	return render_template('mobile_ui.html')

@app.route('/testing')
def testcase():
	return render_template('testrunner.html')


@app.errorhandler(400)
def bad_request(error, message=None):
	if message is not None:
		return make_response(jsonify( {'error': message} ), 400)
	else:
		return make_response(jsonify( {'error': 'bad request'} ), 400)

@app.errorhandler(404)
def not_found(error):
	return make_response(jsonify( {'error': 'resource could not be found'} ), 404)

@app.errorhandler(405)
def not_allowed(error):
	return make_response(jsonify( {'error': 'method is not supported for this resource'} ), 405)

@app.errorhandler(409)
def conflicting_request(error):
	return make_response(jsonify( {'error': 'conflicting request'} ), 409)

''' add the URI to a controller object '''
def add_controller_uri(controller):
	new_controller = {}
	for key in controller:
		if key == 'addr':
			new_controller['uri'] = url_for('controller_api',
				controller_address = controller['addr'],
				_external = True)
		new_controller[key] = controller[key]
	return new_controller

def add_led_set_uri(led_set):
	new_led_set = {}
	for key in led_set:
		if key == 'name':
			new_led_set['uri'] = url_for('set_api', led_set_name = led_set['name'],
			_external = True)
		new_led_set[key] = led_set[key]
	return new_led_set

''' RESTful API for accessing the state of RGB controllers '''
class ControllerAPI(MethodView):
	def __init__(self):
		global coordinator
		self.coordinator = coordinator 
		super(ControllerAPI, self).__init__()

	def get(self, controller_address):
		if controller_address is None:
			controllers = []
			for controller in self.coordinator.get_controllers():
				controllers.append(add_controller_uri(controller))
			return jsonify( {'controller': controllers} )
		else:
			try:
				controller = self.coordinator.get_controller(controller_address)
				return jsonify(add_controller_uri(controller))
			except HttpError as e:
				abort(e.error_code)

	def put(self, controller_address):
		try:
			self.coordinator.update_controller(request.get_json(), controller_address)
			return jsonify(self.coordinator.get_controller(controller_address))
		except HttpError as e:
			print(e)
			abort(e.error_code)


''' Register the routes for the RESTful Controller API '''
controller_view = ControllerAPI.as_view('controller_api')
app.add_url_rule('/controller', defaults = {'controller_address': None},
		view_func=controller_view, methods=['GET',])
app.add_url_rule('/controller/<int:controller_address>',
		view_func=controller_view, methods=['GET',])
app.add_url_rule('/controller/<int:controller_address>',
		view_func=controller_view, methods=['PUT',])

class LedSetAPI(MethodView):
	def __init__(self):
		global coordinator
		self.coordinator = coordinator
		super(LedSetAPI, self).__init__()

	def get(self, led_set_name):
		if led_set_name is None:
			led_sets = []
			for led_set in self.coordinator.get_led_sets():
				led_sets.append(add_led_set_uri(led_set))
			return jsonify( {'led_set' : led_sets} )
		else:
			try:
				led_set = self.coordinator.get_led_set(led_set_name)
				return jsonify( add_led_set_uri(led_set) ) 
			except HttpError as e:
				abort(e.error_code)

	def post(self, led_set_name):
		try:
			led_set_json = request.get_json()
			new_led_set = self.coordinator.add_led_set(led_set_json)
			return jsonify( add_led_set_uri(new_led_set) )
		except HttpError as e:
			print(e)
			abort(e.error_code)

	def put(self, led_set_name):
		try:
			led_set_json = request.get_json()
			led_set = self.coordinator.update_led_set(led_set_json, led_set_name)
			return jsonify( add_led_set_uri(led_set) )
		except HttpError as e:
			print(e)
			abort(e.error_code)

	def delete(self, led_set_name):
		try:
			self.coordinator.remove_led_set(led_set_name)
			return make_response(jsonify( { "status":"successfully removed led set"} ), 204)
		except HttpError as e:
			print(e)
			abort(e.error_code)

''' Register the routes for the RESTful Set API '''
led_set_view = LedSetAPI.as_view('set_api')
app.add_url_rule('/led_set', defaults = {'led_set_name': None},
		view_func=led_set_view, methods=['GET', 'POST'])
app.add_url_rule('/led_set/<led_set_name>', view_func=led_set_view, methods=['GET','PUT', 'DELETE'])


def launch_gevent_server(backend):
	global coordinator
	coordinator = backend
	http_server = WSGIServer(('0.0.0.0', 5000), app)
	try:
		http_server.serve_forever()
	except KeyboardInterrupt:
		http_server.stop
		gevent.shutdown
		print("Server shutdown")
		pass

def launch_flask_server(backend):
	global coordinator
	coordinator = backend
	app.run(host='0.0.0.0', debug = True)

class Frontend(threading.Thread):
	def __init__(self, backend):
		self.backend = backend
		super(Frontend, self).__init__()

	def run(self):
		launch_flask_server(self.backend)

