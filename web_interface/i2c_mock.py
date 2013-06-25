#!/usr/bin/env python3
import decorator
import time
import sys, os
from random import randint
from pprint import pprint

I2C_SLAVE_ADDRESS = 0x28
LED_CNT = 4
LED_CHANNELS = 4
RX_SIZE =  25
RX_RGB_LED = 0
RX_CURRENT_LIMIT = 16
RX_CURRENT_UPDATE = 20
RX_BRIGHTNESS = 21

def retry(howmany, *exception_types, **kwargs):
	timeout = kwargs.get('timeout', None) # seconds
	@decorator.decorator
	def try_it(func, *fargs, **fkwargs):
			for _ in range(howmany):
					try:
						return func(*fargs, **fkwargs)
					except exception_types as e:
						print("I/O Exception, retry %d" % _)
						exc_type, exc_obj, exc_tb = sys.exc_info()
						fname = os.path.split(exc_tb.tb_frame.f_code.co_filename)[1]
						print(exc_type, fname, exc_tb.tb_lineno)
						if timeout is not None: time.sleep(timeout)
	return try_it


class RgbLedSet(object):
	def __init__(self, name="undef"):
		self.leds = []
		self.name = name
	
	def set_name(self, new_name):
		self.name = new_name
		for led in self.leds:
			led.led_set = new_name
	
	def add_led(self, led):
		led.led_set = self.name
		if led not in self.leds:
			self.leds.append(led)
	
	def remove_led(self, led):
		if led in self.leds:
			idx = self.leds.index(led)
			self.leds[idx].led_set = 'none'
			self.leds.remove(led)

	def get_leds(self):
		for led in self.leds:
			if led.led_set != self.name:
				self.leds.remove(led) 
		return self.leds

	def to_dict(self):
		led_list = []
		for led in self.get_leds():
			led_list.append(led.to_dict())
		led_set_dict = {
			'name': self.name,
			'leds': led_list
		}
		
		return led_set_dict


class RgbLed(object):
	def __init__(self, master_addr, channel, current_limit=245):
		self.current_limit = current_limit
		self.r = 0
		self.g1 = 0
		self.g2 = 0
		self.b = 0
		self.current_limit_update = False
		self.master_addr = master_addr
		self.channel = channel
		self.led_set = 'none'

	def __eq__(self, other):
		return self.master_addr == other.master_addr and self.channel == other.channel

	def __neq__(self, other):
		return not self == other

	def set_color(self, rgb_color):
		r = rgb_color.get('r', None)
		g = rgb_color.get('g', None)
		g1 = rgb_color.get('g1', None)
		g2 = rgb_color.get('g2', None)
		b = rgb_color.get('b', None)

		if r is not None: self.r = r
		if g is not None: self.g1 = self.g2 = g
		if g1 is not None: self.g1 = g1
		if g2 is not None: self.g2 = g2
		if b is not None: self.b = b
	
	def get_color(self):
		return {
			'r':self.r, 
			'g':self.g1,
			'g1':self.g1,
			'g2':self.g2,
			'b':self.b,
		}
 
	def set_current_limit(self, current_limit):
		self.current_limit = current_limit
		self.current_limit_update = True
		
	def to_dict(self):
		led_dict = {}
		led_dict['channel'] = self.channel
		led_dict['controller'] = self.master_addr
		led_dict['current_limit'] = self.current_limit
		led_dict['color'] = self.get_color()
		led_dict['led_set'] = self.led_set
		
		return led_dict

class RgbController(object):
	def __init__(self, address, name, led_cnt = LED_CNT):
		self.i2c_address = address
		self.name = name
		self.brightness = 0
		self.i2c_buffer = bytearray(RX_SIZE)
		self.led_cnt = led_cnt
		self.leds = []
		self.create_leds()
	
	def create_leds(self):
		for idx in range(self.led_cnt):
			self.leds.append(RgbLed(self.i2c_address, idx))

	def get_led(self, index):
		return self.leds[index]
		
	def set_brightness(self, brightness):
		self.brightness = brightness
		self.i2c_buffer[RX_BRIGHTNESS] = brightness
	
	def update_i2c_buffer(self):
		for idx in range(len(self.leds)):
				led = self.leds[idx].get('led', None)
				if not led:
					continue
				self.i2c_buffer[idx*LED_CHANNELS] = led.r
				self.i2c_buffer[idx*LED_CHANNELS+1] = led.g1
				self.i2c_buffer[idx*LED_CHANNELS+2] = led.g2
				self.i2c_buffer[idx*LED_CHANNELS+3] = led.b
				self.i2c_buffer[RX_CURRENT_LIMIT+idx] = led.current_limit
				if (led.current_limit_update):
					self.i2c_buffer[RX_CURRENT_UPDATE] = 0x01
					led.current_limit_update = False;

	def get_state(self):
		return self.i2c_buffer
	
	def to_dict(self):
		leds = []
		for led  in self.leds:
			leds.append(led.to_dict())
		controller_dict = {
				'addr': self.i2c_address, 
				'name': self.name, 
				'brightness': self.brightness,
				'led_cnt': self.led_cnt,
				'leds': leds
			}

		return controller_dict


class RgbCoordinator(object):
	def __init__(self):
		#TODO: should store list of known addresses and check them at restart
		self.controllers = {}
		self.led_sets = {}
		self.create_mock_controllers()
		self.random_colors()

	def random_colors(self):
		for controller in self.controllers.values():
			for led in controller.leds:
				color = dict(r=randint(0, 255), g=randint(0, 255), b=randint(0,255))
				led.set_color(color)

	def scan_i2c_bus(self):
		'''
		scan a range of the I2C bus in order to find new RGBControllers,
		skip known addresses,
		add newly found RGBControllers to the local list
		'''

	# create a list of controllers that can be jsonified for the RESTful API
	def get_controllers(self):
		controller_list = []
		for controller in self.controllers.values():
			controller_list.append(controller.to_dict())

		return controller_list

	def get_controller(self, address):
		if address not in self.controllers:
			raise HttpError('No controller with given address', 404)
		return self.controllers[address].to_dict()

	def update_controller(self, controller_json):
		verify_rgb_controller_json(controller_json)

		# identify the local controller that will be updated
		address = int(controller_json['addr'])
		if address not in self.controllers:
			raise HttpError('No controller with given address', 404)
		controller = self.controllers[address]
		controller.brightness = int(controller_json['brightness'])
		controller.name = controller_json['name']
		# TODO: should it be possible to change color values and set information
		# via the controller API? Only Leds that are not part of a set ?
		# update the led information
		if 'leds' in controller_json:
			for led_json in controller_json['leds']:
				verify_rgb_led_json(led_json)
				if 'color' in led_json:
					self.update_led_color(led_json)
			
		return controller.to_dict()

	def get_led_sets(self):
		led_set_list = []
		for led_set in self.led_sets.values():
			led_set_list.append( led_set.to_dict() )
		return led_set_list

	def get_led_set(self, led_set_name):
		if led_set_name not in self.led_sets:
			raise HttpError('No led-set with given name exists', 404)
		return self.led_sets[led_set_name].to_dict()

	def add_led_set(self, led_set_json):
		# check if a led_set with the given name already exists
		verify_rgb_led_set_json(led_set_json)
		if led_set_json['name'] in self.led_sets:
				raise HttpError('Name already exists', 409)

		# create the new led_set and register the leds
		led_set = RgbLedSet(led_set_json['name'])
		for led_json in led_set_json['leds']:
			led = self.identify_led(led_json)
			led_set.add_led(led)
			if 'color' in led_json:
				self.update_led_color(led_json, led)
		self.led_sets[led_set.name] = led_set
		
		return self.get_led_set(led_set.name)
	
	def update_led_set(self, led_set_json, led_set_name):
		# check if a led_set with the given name exists
		verify_rgb_led_set_json(led_set_json)
		if led_set_name not in self.led_sets:
				raise HttpError('No led-set with given name exists', 404)

		# check if new leds were added to the set and update values of all leds
		led_set = self.led_sets[led_set_name]
		tmp_led_list = []
		for led_json in led_set_json['leds']:
			led = self.identify_led(led_json)
			tmp_led_list.append(led)
			if led not in led_set.leds:
				led_set.add_led(led)
			if 'color' in led_json:
				self.update_led_color(led_json, led)
		
		# check if leds were removed from the set
		for led in set(led_set.leds).difference(tmp_led_list):
			led_set.remove_led(led)
			led.set_name = 'none'
		
		# check if the name of the LED-Set was changed
		if (led_set_name != led_set_json['name']):
			# remove the existing LED-Set from the dictionary,
			del self.led_sets[led_set_name]
			# modify the name and re-add the LED-Set to the dictionary
			led_set.set_name(led_set_json['name'])
			self.led_sets[led_set.name] = led_set
		return led_set.to_dict()
	
	def remove_led_set(self, led_set_name):
		# check if a led_set with the given name exists
		if led_set_name not in self.led_sets:
				raise HttpError('No led-set with given name exists', 404)
		
		led_set = self.led_sets[led_set_name]
		led_set.set_name('none')
		del self.led_sets[led_set_name]

	# update values of led instance
	def update_led_color(self, led_json, led = None):
		if led is None:
			led = self.identify_led(led_json)
		led.set_color(led_json['color'])
		led.set_current_limit(led_json['current_limit'])

	# identify the led instance belonging to the json representation
	def identify_led(self, led_json):
		verify_rgb_led_json(led_json)
		address = int(led_json['controller'])
		if address not in self.controllers:
			raise HttpError('No controller with given address', 404)
		led = self.controllers[address].get_led(int(led_json['channel']))
		return led

	def create_mock_controllers(self):
		for i in range(2):
			address = 0x21+i
			self.controllers[address] = RgbController(address, 'controller0'+str(i))
			self.controllers[address].set_brightness(randint(0, 255))

# verify the completeness of the controller update
def verify_rgb_controller_json(controller_json):
	keys = ['addr', 'brightness', 'name', 'led_cnt']
	for key in keys:
		if key not in controller_json:
			raise HttpError('Incomplete data set', 409)

# verify that the json representation of an RgbLed is complete
def verify_rgb_led_json(led_json):
	keys = ['controller', 'channel', 'led_set', 'current_limit']
	for key in keys:
		if key not in led_json:
			raise HttpError('Incomplete data set', 409)

# verify that the json representation of an RgbLedSet is complete
def verify_rgb_led_set_json(led_set_json):
	keys = ['name', 'leds']
	for key in keys:
		if key not in led_set_json:
			raise HttpError('Incomplete data set', 409)
		if key == 'leds':
			for led_json in led_set_json['leds']:
				verify_rgb_led_json(led_json)

class HttpError(Exception):
	def __init__(self, message, error_code):
		super(HttpError, self).__init__(message)
		self.error_code = error_code
		
