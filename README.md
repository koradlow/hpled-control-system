HPLED-Control System
====================
The goal of this project is to provide a Web-enabled system for driving 
and controlling high-power LEDs (HPLEDS). 

The project evolved into a distributed embedded system, consisting of 
custom controller boards for HPLEDs, a Linux based coordinator for 
controlling multiple controller boards (Raspberry Pi), a dynamic 
RESTful web-API and a responsive Js web user interface.

The project consists of several subprojects:
* HPLED-Driver PCB: Eagle files for the PCB design can be found in the 
*schematics* folder
* HPLED-Driver Software: The software running on the PCBs is available in
the *rgb-pcb* folder
* Web-interface: The jQuery mobile & flask based web interface can be 
found in the folder *web_interface*
* Coordinator control software: The software for interacting with the 
HPLED-Driver PCB can be found in the *i2c_raspberry* folder

