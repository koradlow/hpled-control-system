#!/usr/bin/env python3
import quick2wire.i2c as i2c
import decorator
import time

address = 0x2A

def retry(howmany, *exception_types, **kwargs):
	timeout = kwargs.get('timeout', None) # seconds
	@decorator.decorator
	def tryIt(func, *fargs, **fkwargs):
			for _ in range(howmany):
					try: return func(*fargs, **fkwargs)
					except exception_types or Exception:
							print("I/O Exception, retry %d" % _)
							if timeout is not None: time.sleep(timeout)
	return tryIt

@retry(2, IOError)
def set_brightness(value):
	print("setting brightness to %d" % value)
	with i2c.I2CMaster() as bus:
		dest_brightness = 0x14;
		bus.transaction(
			i2c.writing_bytes(address, dest_brightness),
			i2c.writing_bytes(address, value, value, value, value, 0x01))

@retry(2, IOError)
def set_led(led, rgb):
	with i2c.I2CMaster() as bus:
		dest_led = 0x05 * led;
		bus.transaction(
			i2c.writing_bytes(address, dest_led),
			i2c.writing_bytes(address, rgb[0], rgb[1], rgb[1], rgb[2], rgb[3]))

@retry(2, IOError)
def read(source, count):
	with i2c.I2CMaster() as bus:
		print("reading %d bytes from %02x" % (count, source))
		result = bus.transaction(
			i2c.writing_bytes(address, source),
			i2c.reading(address, count))

		return result[0]

if __name__ == "__main__":
	cnt = 0
	set_brightness(215)
	for n in range(0, 20):
		for i in range(0, 200, 10):
			try:
				print("set %d" % cnt)
				cnt+=1
				set_led(0x00, [0x00, i, 0xFF-i, 0x0A+i])
			except:
				print("I/O Error")
		print(" ")

	set_led(0x01, [0xAA, 0xAB, 0xAC, 0xAD])
	set_led(0x02, [0xFF, 0xFE, 0xFD, 0xFB])

	read_result = read(0x00, 32)
	print("read %d bytes" % len(read_result))
	i = 0
	for n in read_result:
		print("%02x: %02x" %(i, n))
		i = i+1
	print(" ")
