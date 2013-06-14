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
from flask import request, Response, render_template, jsonify 
from flask import make_response, url_for
from flask.views import MethodView

@app.route('/index')
@app.route('/')
def render_website():
	return render_template('base_design.html')

@app.errorhandler(404)
def not_found(error):
	return make_response(jsonify( {'error': 'Not found'} ), 404)

@app.errorhandler(400)
def bad_request(error=None):
	if error is not None:
		return make_response(jsonify( {'error': error} ), 400)
	else:
		return make_response(jsonify( {'error': 'bad request'} ), 400)

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
			pprint(controllers)
			return jsonify( {'controllers' : controllers} )
		else:
			controller = self.coordinator.get_controller(controller_address)
			if controller is not None:
				pprint(controller)
				return jsonify(controller)
			return not_found(404)
	
	def put(self, controller_address):
		controller = self.coordinator.get_controller(controller_address)
		if controller is None:
			return not_found(404)
		try:
			self.coordinator.update_controller(request.json)
			return jsonify(self.coordinator.get_controller(controller_address))
		except Exception as e:
			return bad_request(e.strerror)


''' Register the routes for the RESTful Controller API '''
controller_view = ControllerAPI.as_view('controller_api')
app.add_url_rule('/controller', defaults = {'controller_address': None},
		view_func=controller_view, methods=['GET',])
app.add_url_rule('/controller/<int:controller_address>',
		view_func=controller_view, methods=['GET',])
app.add_url_rule('/controller/<int:controller_address>',
		view_func=controller_view, methods=['PUT',])


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
	app.run(debug = True)

class Frontend(threading.Thread):
	def __init__(self, backend):
		self.backend = backend
		super(Frontend, self).__init__()

	def run(self):
		launch_flask_server(self.backend)

