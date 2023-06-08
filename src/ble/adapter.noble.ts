// @ts-nocheck

/* @license
 *
 * BLE Abstraction Tool: noble adapter
 *
 * The MIT License (MIT)
 *
 * Copyright (c) 2016 Rob Moran
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

// https://github.com/umdjs/umd
(function (root, factory) {
    const os = require('node:os');
    let platform = os.platform();
    let nobleble = "noble";
    switch(platform) {
        case 'aix': 
            break;
        case 'android': 
            break;
        case 'darwin': 
         nobleble = "@abandonware/noble";
            break;
        case 'freebsd':
            break;
        case 'linux':
            nobleble = "node-ble";
            break;
        case 'openbsd': 
            break;
        case 'sunos':
            break;
        case 'win32':
        nobleble = "noble-winrt";
            break;    
        default: console.log("unknown platform");
    }
    if (typeof define === 'function' && define.amd) {
        // AMD. Register as an anonymous module.
        define(['noble', 'bleat', './helpers'], factory);
    } else if (typeof exports === 'object') {
        // Node. Does not work with strict CommonJS
        module.exports = function(bleat) {
            return factory(require(nobleble), bleat, require('./helpers'));
        };
    } else {
        // Browser globals with support for web workers (root is window)
        factory(root.noble, root.bleat, root.bleatHelpers);
    }
}(this, function(noble, bleat, helpers) {
    "use strict";

    // Guard against bleat being navigator.bluetooth
    if (!bleat._addAdapter) return;

    function checkForError(errorFn, continueFn) {
        return function(error) {
            if (error) errorFn(error);
            else if (typeof continueFn === "function") {
                var args = [].slice.call(arguments, 1);
                continueFn.apply(this, args);
            }
        };
    }

    function bufferToDataView(buffer) {
        // Buffer to ArrayBuffer
        var arrayBuffer = new Uint8Array(buffer).buffer;
        return new DataView(arrayBuffer);
    }

    function dataViewToBuffer(dataView) {
        // DataView to TypedArray
        var typedArray = new Uint8Array(dataView.buffer);
        return new Buffer.from(typedArray);
    }

    // for linux we are using node-ble
    if(noble.hasOwnProperty('createBluetooth')){
        const {createBluetooth} = noble;
        const {bluetooth, destroy} = createBluetooth()
        
        bleat._addAdapter("noble", {
            deviceHandles: {},
            serviceHandles: {},
            characteristicHandles: {},
            descriptorHandles: {},
            charNotifies: {},
            foundFn: null,
            initialised: false,
            adapter:null,
            init: async function(continueFn, errorFn) {
                if(this.adapter===null){
                    let adpt = await bluetooth.adapters();
                    if(adpt.length===0){errorFn("No adaptor available");return;}
                    this.adapter = await bluetooth.defaultAdapter()
                }
                if(! await this.adapter.isPowered()){
                    errorFn("Adaptor powered off");return;
                }
                if (this.initialised) return continueFn();
                if(!await this.adapter.isDiscovering()){
                    await this.adapter.startDiscovery()
                }
               
                this.initialised = true;
                continueFn();
            },
            startScan:  function(serviceUUIDs, foundFn, completeFn, errorFn) {
                this.init(async function() {
                    this.deviceHandles = {};
                   
                    if (serviceUUIDs.length === 0) this.foundFn = foundFn;
                    else this.foundFn = function(device) {
                        serviceUUIDs.forEach(function(serviceUUID) {
                            if (device.uuids.indexOf(serviceUUID) >= 0) {
                                foundFn(device);
                                return;
                            }
                        });
                    };
                    let deviceFound = await this.adapter.devices();
                    deviceFound.forEach(async dMac=>{
                        let dev = await this.adapter.getDevice(dMac)
                        let deviceInfo = {}
                        try {
                             deviceInfo = {
                                device:dev,
                                address : await dev.helper.prop('Address') ,
                                name: await dev.helper.prop('Name'),
                                advertisement: {
                                    serviceUuids: await dev.helper.prop('UUIDs'),
                                    // manufacturerData: await dev.helper.prop('ManufacturerData'),
                                    localName: await dev.helper.prop('Name'),
                                    // serviceData: await dev.helper.prop('ServiceData'),
                                    // txPowerLevel: await dev.helper.prop('TxPower'),
                                    rssi: await dev.helper.prop('RSSI') 
                                }
    
                            }
                        } catch (error) {
                            // console.log(error)
                            return
                        }
                        
                        var deviceID = (deviceInfo.address && deviceInfo.address !== "unknown") ? deviceInfo.address : deviceInfo.id;
                        if (!this.deviceHandles[deviceID]) this.deviceHandles[deviceID] = deviceInfo;

                        var serviceUUIDs = [];
                        if (deviceInfo.advertisement.serviceUuids) {
                            deviceInfo.advertisement.serviceUuids.forEach(function(serviceUUID) {
                                serviceUUIDs.push(helpers.getCanonicalUUID(serviceUUID));
                            });
                        }

                        var manufacturerData = {};
                        if (deviceInfo.advertisement.manufacturerData) {
                            // First 2 bytes are 16-bit company identifier
                            var company = deviceInfo.advertisement.manufacturerData.readUInt16LE(0);
                            company = ("0000" + company.toString(16)).slice(-4);
                            // Remove company ID
                            var buffer = deviceInfo.advertisement.manufacturerData.slice(2);
                            manufacturerData[company] = bufferToDataView(buffer);
                        }

                        var serviceData = {};
                        if (deviceInfo.advertisement.serviceData) {
                            deviceInfo.advertisement.serviceData.forEach(function(serviceAdvert) {
                                serviceData[helpers.getCanonicalUUID(serviceAdvert.uuid)] = bufferToDataView(serviceAdvert.data);
                            });
                        }

                        this.foundFn({
                            _handle: deviceID,
                            id: deviceID,
                            name: deviceInfo.advertisement.localName,
                            uuids: serviceUUIDs,
                            adData: {
                                manufacturerData: manufacturerData,
                                serviceData: serviceData,
                                txPower: deviceInfo.advertisement.txPowerLevel,
                                rssi: deviceInfo.rssi
                            }
                        });
                    });
                }.bind(this), errorFn);
            },
            stopScan: async function(errorFn) {
                this.foundFn = null;
                if(await this.adapter.isDiscovering()){
                    await this.adapter.stopDiscovery()
                }
                
            },
            connect: async function(handle, connectFn, disconnectFn, errorFn) {
                var baseDevice = this.deviceHandles[handle].device;
                baseDevice.on("connect", connectFn);
                baseDevice.on("disconnect", function() {
                    this.serviceHandles = {};
                    this.characteristicHandles = {};
                    this.descriptorHandles = {};
                    this.charNotifies = {};
                    disconnectFn();
                }.bind(this));
                baseDevice.connect();
                checkForError(errorFn)
            },
            disconnect: function(handle, errorFn) {
                this.deviceHandles[handle].device.disconnect(checkForError(errorFn));
            },
            discoverServices:  async function(handle, serviceUUIDs, completeFn, errorFn) {
                var baseDevice = this.deviceHandles[handle];
                let gattServer = await baseDevice.device.gatt()
                var discovered = [];
                    baseDevice.advertisement.serviceUuids.forEach(async function(serviceInfo,index){
                        var serviceUUID = helpers.getCanonicalUUID(serviceInfo);
                            try {
                                if (!this.serviceHandles[serviceUUID]) this.serviceHandles[serviceUUID] = await gattServer.getPrimaryService(serviceUUID);
                            
                                discovered.push({
                                    _handle: serviceUUID,
                                    uuid: serviceUUID,
                                    primary: true
                                });
                            } catch (error) {
                                
                            }
                       if(baseDevice.advertisement.serviceUuids.length===(index+1)){
                        completeFn(discovered)
                       }
                    }.bind(this))
                
               
            },
            discoverIncludedServices: function(handle, serviceUUIDs, completeFn, errorFn) {
                var serviceInfo = this.serviceHandles[handle];
                serviceInfo.discoverIncludedServices([], checkForError(errorFn, function(services) {

                    var discovered = [];
                    services.forEach(function(serviceInfo) {
                        var serviceUUID = helpers.getCanonicalUUID(serviceInfo.uuid);

                        if (serviceUUIDs.length === 0 || serviceUUIDs.indexOf(serviceUUID) >= 0) {
                            if (!this.serviceHandles[serviceUUID]) this.serviceHandles[serviceUUID] = serviceInfo;

                            discovered.push({
                                _handle: serviceUUID,
                                uuid: serviceUUID,
                                primary: false
                            });
                        }
                    }, this);

                    completeFn(discovered);
                }.bind(this)));
            },
            discoverCharacteristics: async function(handle, characteristicUUIDs, completeFn, errorFn) {
                var serviceInfo = this.serviceHandles[handle];
                let characteristics = await serviceInfo.characteristics() ;
                    var discovered = [];
                    characteristics.forEach(async function(characteristicInfo,index) {
                        var charUUID = helpers.getCanonicalUUID(characteristicInfo);

                        // if (characteristicUUIDs.length === 0 || characteristicUUIDs.indexOf(charUUID) >= 0) {
                            characteristicInfo = await serviceInfo.getCharacteristic(characteristicInfo)
                            if (!this.characteristicHandles[charUUID]){
                                this.characteristicHandles[charUUID] = characteristicInfo
                            };
                            let flags = await characteristicInfo.getFlags()
                            discovered.push({
                                _handle: charUUID,
                                uuid: charUUID,
                                properties: {
                                    broadcast:                  (flags.indexOf("broadcast") >= 0),
                                    read:                       (flags.indexOf("read") >= 0),
                                    writeWithoutResponse:       (flags.indexOf("write-without-response") >= 0),
                                    write:                      (flags.indexOf("write") >= 0),
                                    notify:                     (flags.indexOf("notify") >= 0),
                                    indicate:                   (flags.indexOf("indicate") >= 0),
                                    authenticatedSignedWrites:  (flags.indexOf("authenticated-signed-writes") >= 0),
                                    reliableWrite:              (flags.indexOf("reliable-write") >= 0),
                                    writableAuxiliaries:        (flags.indexOf("writable-auxiliaries") >= 0)
                                }
                            });

                            characteristicInfo.on('valuechanged', function(data) {
                                if (typeof this.charNotifies[charUUID] === "function") {
                                    var dataView = bufferToDataView(data);
                                    this.charNotifies[charUUID](dataView);
                                }
                            }.bind(this));
                        // }
                        if(characteristics.length===(index+1)){
                            completeFn(discovered)
                           }
                    }, this);

            },
            discoverDescriptors: function(handle, descriptorUUIDs, completeFn, errorFn) {
                // var characteristicInfo = this.characteristicHandles[handle];
                // characteristicInfo.discoverDescriptors(checkForError(errorFn, function(descriptors) {
                //     var discovered = [];
                //     descriptors.forEach(function(descriptorInfo) {
                //         var descUUID = helpers.getCanonicalUUID(descriptorInfo.uuid);
                //         if (descriptorUUIDs.length === 0 || descriptorUUIDs.indexOf(descUUID) >= 0) {
                //             var descHandle = characteristicInfo.uuid + "-" + descriptorInfo.uuid;
                //             if (!this.descriptorHandles[descHandle]) this.descriptorHandles[descHandle] = descriptorInfo;

                //             discovered.push({
                //                 _handle: descHandle,
                //                 uuid: descUUID
                //             });
                //         }
                //     }, this);

                //     completeFn(discovered);
                // }.bind(this)));
            },
            readCharacteristic: function(handle, completeFn, errorFn) {
                // this.characteristicHandles[handle].read(checkForError(errorFn, function(data) {
                //     var dataView = bufferToDataView(data);
                //     completeFn(dataView);
                // }));
            },
            writeCharacteristic: async function(handle, dataView, completeFn, errorFn) {
                var buffer = dataViewToBuffer(dataView);
                await this.characteristicHandles[handle].writeValue(buffer).catch(checkForError(errorFn, completeFn));
                checkForError(errorFn, completeFn)()
            },
            writeCharacteristicWithoutResponse: async function(handle, dataView, completeFn, errorFn) {
                var buffer = dataViewToBuffer(dataView);
                await this.characteristicHandles[handle].writeValueWithResponse(buffer).catch(checkForError(errorFn, completeFn));
                checkForError(errorFn, completeFn)()
            },
            enableNotify: async function(handle, notifyFn, completeFn, errorFn) {
                if (this.charNotifies[handle]) {
                    this.charNotifies[handle] = notifyFn;
                    return completeFn();
                }
               await this.characteristicHandles[handle].startNotifications()
               if(await this.characteristicHandles[handle].isNotifying()){
                this.charNotifies[handle] = notifyFn;
                completeFn();
               }
            },
            disableNotify: function(handle, completeFn, errorFn) {
                // if (!this.charNotifies[handle]) {
                //     return completeFn();
                // }
                // this.characteristicHandles[handle].once("notify", function(state) {
                //     if (state !== false) return errorFn("notify failed to disable");
                //     if (this.charNotifies[handle]) delete this.charNotifies[handle];
                //     completeFn();
                // }.bind(this));
                // this.characteristicHandles[handle].notify(false, checkForError(errorFn));
            },
            readDescriptor: function(handle, completeFn, errorFn) {
                // this.descriptorHandles[handle].readValue(checkForError(errorFn, function(data) {
                //     var dataView = bufferToDataView(data);
                //     completeFn(dataView);
                // }));
            },
            writeDescriptor: function(handle, dataView, completeFn, errorFn) {
                // var buffer = dataViewToBuffer(dataView);
                // this.descriptorHandles[handle].writeValue(buffer, checkForError(errorFn, completeFn));
            }
        });
    }else if (noble) {
    // https://github.com/sandeepmistry/noble
        bleat._addAdapter("noble", {
            deviceHandles: {},
            serviceHandles: {},
            characteristicHandles: {},
            descriptorHandles: {},
            charNotifies: {},
            foundFn: null,
            initialised: false,
            init: function(continueFn, errorFn) {
                if (this.initialised) return continueFn();

                noble.on('discover', function(deviceInfo) {
                    if (this.foundFn) {
                        var deviceID = (deviceInfo.address && deviceInfo.address !== "unknown") ? deviceInfo.address : deviceInfo.id;
                        if (!this.deviceHandles[deviceID]) this.deviceHandles[deviceID] = deviceInfo;

                        var serviceUUIDs = [];
                        if (deviceInfo.advertisement.serviceUuids) {
                            deviceInfo.advertisement.serviceUuids.forEach(function(serviceUUID) {
                                serviceUUIDs.push(helpers.getCanonicalUUID(serviceUUID));
                            });
                        }

                        var manufacturerData = {};
                        if (deviceInfo.advertisement.manufacturerData) {
                            // First 2 bytes are 16-bit company identifier
                            var company = deviceInfo.advertisement.manufacturerData.readUInt16LE(0);
                            company = ("0000" + company.toString(16)).slice(-4);
                            // Remove company ID
                            var buffer = deviceInfo.advertisement.manufacturerData.slice(2);
                            manufacturerData[company] = bufferToDataView(buffer);
                        }

                        var serviceData = {};
                        if (deviceInfo.advertisement.serviceData) {
                            deviceInfo.advertisement.serviceData.forEach(function(serviceAdvert) {
                                serviceData[helpers.getCanonicalUUID(serviceAdvert.uuid)] = bufferToDataView(serviceAdvert.data);
                            });
                        }

                        this.foundFn({
                            _handle: deviceID,
                            id: deviceID,
                            name: deviceInfo.advertisement.localName,
                            uuids: serviceUUIDs,
                            adData: {
                                manufacturerData: manufacturerData,
                                serviceData: serviceData,
                                txPower: deviceInfo.advertisement.txPowerLevel,
                                rssi: deviceInfo.rssi
                            }
                        });
                    }
                }.bind(this));
                this.initialised = true;
                continueFn();
            },
            startScan: function(serviceUUIDs, foundFn, completeFn, errorFn) {
                this.init(function() {
                    this.deviceHandles = {};
                    var stateCB = function(state) {
                        if (state === "poweredOn") {
                            if (serviceUUIDs.length === 0) this.foundFn = foundFn;
                            else this.foundFn = function(device) {
                                serviceUUIDs.forEach(function(serviceUUID) {
                                    if (device.uuids.indexOf(serviceUUID) >= 0) {
                                        foundFn(device);
                                        return;
                                    }
                                });
                            };
                            noble.startScanning([], false, checkForError(errorFn, completeFn));
                        }
                        else errorFn("adapter not enabled");
                    }.bind(this);
                    if (noble.state === "unknown") noble.once('stateChange', stateCB.bind(this));
                    else stateCB(noble.state);
                }.bind(this), errorFn);
            },
            stopScan: function(errorFn) {
                this.foundFn = null;
                noble.stopScanning();
            },
            connect: function(handle, connectFn, disconnectFn, errorFn) {
                var baseDevice = this.deviceHandles[handle];
                baseDevice.once("connect", connectFn);
                baseDevice.once("disconnect", function() {
                    this.serviceHandles = {};
                    this.characteristicHandles = {};
                    this.descriptorHandles = {};
                    this.charNotifies = {};
                    disconnectFn();
                }.bind(this));
                baseDevice.connect(checkForError(errorFn));
            },
            disconnect: function(handle, errorFn) {
                this.deviceHandles[handle].disconnect(checkForError(errorFn));
            },
            discoverServices: function(handle, serviceUUIDs, completeFn, errorFn) {
                var baseDevice = this.deviceHandles[handle];
                baseDevice.discoverServices([], checkForError(errorFn, function(services) {

                    var discovered = [];
                    services.forEach(function(serviceInfo) {
                        var serviceUUID = helpers.getCanonicalUUID(serviceInfo.uuid);

                        if (serviceUUIDs.length === 0 || serviceUUIDs.indexOf(serviceUUID) >= 0) {
                            if (!this.serviceHandles[serviceUUID]) this.serviceHandles[serviceUUID] = serviceInfo;

                            discovered.push({
                                _handle: serviceUUID,
                                uuid: serviceUUID,
                                primary: true
                            });
                        }
                    }, this);

                    completeFn(discovered);
                }.bind(this)));
            },
            discoverIncludedServices: function(handle, serviceUUIDs, completeFn, errorFn) {
                var serviceInfo = this.serviceHandles[handle];
                serviceInfo.discoverIncludedServices([], checkForError(errorFn, function(services) {

                    var discovered = [];
                    services.forEach(function(serviceInfo) {
                        var serviceUUID = helpers.getCanonicalUUID(serviceInfo.uuid);

                        if (serviceUUIDs.length === 0 || serviceUUIDs.indexOf(serviceUUID) >= 0) {
                            if (!this.serviceHandles[serviceUUID]) this.serviceHandles[serviceUUID] = serviceInfo;

                            discovered.push({
                                _handle: serviceUUID,
                                uuid: serviceUUID,
                                primary: false
                            });
                        }
                    }, this);

                    completeFn(discovered);
                }.bind(this)));
            },
            discoverCharacteristics: function(handle, characteristicUUIDs, completeFn, errorFn) {
                var serviceInfo = this.serviceHandles[handle];
                serviceInfo.discoverCharacteristics([], checkForError(errorFn, function(characteristics) {

                    var discovered = [];
                    characteristics.forEach(function(characteristicInfo) {
                        var charUUID = helpers.getCanonicalUUID(characteristicInfo.uuid);

                        if (characteristicUUIDs.length === 0 || characteristicUUIDs.indexOf(charUUID) >= 0) {
                            if (!this.characteristicHandles[charUUID]) this.characteristicHandles[charUUID] = characteristicInfo;

                            discovered.push({
                                _handle: charUUID,
                                uuid: charUUID,
                                properties: {
                                    broadcast:                  (characteristicInfo.properties.indexOf("broadcast") >= 0),
                                    read:                       (characteristicInfo.properties.indexOf("read") >= 0),
                                    writeWithoutResponse:       (characteristicInfo.properties.indexOf("writeWithoutResponse") >= 0),
                                    write:                      (characteristicInfo.properties.indexOf("write") >= 0),
                                    notify:                     (characteristicInfo.properties.indexOf("notify") >= 0),
                                    indicate:                   (characteristicInfo.properties.indexOf("indicate") >= 0),
                                    authenticatedSignedWrites:  (characteristicInfo.properties.indexOf("authenticatedSignedWrites") >= 0),
                                    reliableWrite:              (characteristicInfo.properties.indexOf("reliableWrite") >= 0),
                                    writableAuxiliaries:        (characteristicInfo.properties.indexOf("writableAuxiliaries") >= 0)
                                }
                            });

                            characteristicInfo.on('data', function(data, isNotification) {
                                if (isNotification === true && typeof this.charNotifies[charUUID] === "function") {
                                    var dataView = bufferToDataView(data);
                                    this.charNotifies[charUUID](dataView);
                                }
                            }.bind(this));
                        }
                    }, this);

                    completeFn(discovered);
                }.bind(this)));
            },
            discoverDescriptors: function(handle, descriptorUUIDs, completeFn, errorFn) {
                var characteristicInfo = this.characteristicHandles[handle];
                characteristicInfo.discoverDescriptors(checkForError(errorFn, function(descriptors) {
                    var discovered = [];
                    descriptors.forEach(function(descriptorInfo) {
                        var descUUID = helpers.getCanonicalUUID(descriptorInfo.uuid);
                        if (descriptorUUIDs.length === 0 || descriptorUUIDs.indexOf(descUUID) >= 0) {
                            var descHandle = characteristicInfo.uuid + "-" + descriptorInfo.uuid;
                            if (!this.descriptorHandles[descHandle]) this.descriptorHandles[descHandle] = descriptorInfo;

                            discovered.push({
                                _handle: descHandle,
                                uuid: descUUID
                            });
                        }
                    }, this);

                    completeFn(discovered);
                }.bind(this)));
            },
            readCharacteristic: function(handle, completeFn, errorFn) {
                this.characteristicHandles[handle].read(checkForError(errorFn, function(data) {
                    var dataView = bufferToDataView(data);
                    completeFn(dataView);
                }));
            },
            writeCharacteristic: function(handle, dataView, completeFn, errorFn) {
                var buffer = dataViewToBuffer(dataView);
                this.characteristicHandles[handle].write(buffer, false, checkForError(errorFn, completeFn));
            },
            writeCharacteristicWithoutResponse: function(handle, dataView, completeFn, errorFn) {
                var buffer = dataViewToBuffer(dataView);
                this.characteristicHandles[handle].write(buffer, true, checkForError(errorFn, completeFn));
            },
            enableNotify: function(handle, notifyFn, completeFn, errorFn) {
                if (this.charNotifies[handle]) {
                    this.charNotifies[handle] = notifyFn;
                    return completeFn();
                }
                this.characteristicHandles[handle].once("notify", function(state) {
                    if (state !== true) return errorFn("notify failed to enable");
                    this.charNotifies[handle] = notifyFn;
                    completeFn();
                }.bind(this));
                this.characteristicHandles[handle].notify(true, checkForError(errorFn));
            },
            disableNotify: function(handle, completeFn, errorFn) {
                if (!this.charNotifies[handle]) {
                    return completeFn();
                }
                this.characteristicHandles[handle].once("notify", function(state) {
                    if (state !== false) return errorFn("notify failed to disable");
                    if (this.charNotifies[handle]) delete this.charNotifies[handle];
                    completeFn();
                }.bind(this));
                this.characteristicHandles[handle].notify(false, checkForError(errorFn));
            },
            readDescriptor: function(handle, completeFn, errorFn) {
                this.descriptorHandles[handle].readValue(checkForError(errorFn, function(data) {
                    var dataView = bufferToDataView(data);
                    completeFn(dataView);
                }));
            },
            writeDescriptor: function(handle, dataView, completeFn, errorFn) {
                var buffer = dataViewToBuffer(dataView);
                this.descriptorHandles[handle].writeValue(buffer, checkForError(errorFn, completeFn));
            }
        });
    }
}));