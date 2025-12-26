package com.tapir.runtime.audio

import android.bluetooth.BluetoothA2dp
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothProfile
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.media.AudioDeviceInfo
import android.media.AudioManager
import android.os.Build
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule

class BluetoothAudioModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    private val audioManager: AudioManager by lazy {
        reactContext.getSystemService(Context.AUDIO_SERVICE) as AudioManager
    }
    
    private val bluetoothAdapter: BluetoothAdapter? by lazy {
        BluetoothAdapter.getDefaultAdapter()
    }
    
    private var a2dpProxy: BluetoothA2dp? = null
    private var listenerCount = 0
    
    private val audioReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            when (intent.action) {
                // Wired headphone changes
                AudioManager.ACTION_HEADSET_PLUG -> {
                    val plugged = intent.getIntExtra("state", 0) == 1
                    sendEvent("headphonesChanged", Arguments.createMap().apply {
                        putBoolean("connected", plugged)
                        putString("type", "wired")
                    })
                }
                
                // Bluetooth A2DP connection changes
                BluetoothA2dp.ACTION_CONNECTION_STATE_CHANGED -> {
                    val state = intent.getIntExtra(BluetoothProfile.EXTRA_STATE, -1)
                    val device = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                        intent.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE, BluetoothDevice::class.java)
                    } else {
                        @Suppress("DEPRECATION")
                        intent.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE)
                    }
                    
                    val eventName = if (state == BluetoothProfile.STATE_CONNECTED) 
                        "deviceConnected" else "deviceDisconnected"
                    
                    sendEvent(eventName, Arguments.createMap().apply {
                        putString("address", device?.address)
                        putString("name", device?.name)
                        putBoolean("isTapir", device?.name?.contains("TAPIR", ignoreCase = true) == true)
                    })
                }
                
                // Ringer mode changes
                AudioManager.RINGER_MODE_CHANGED_ACTION -> {
                    val mode = intent.getIntExtra(AudioManager.EXTRA_RINGER_MODE, AudioManager.RINGER_MODE_NORMAL)
                    sendEvent("ringerModeChanged", Arguments.createMap().apply {
                        putString("mode", ringerModeToString(mode))
                    })
                }
            }
        }
    }

    override fun getName(): String = "BluetoothAudio"

    override fun initialize() {
        super.initialize()
        
        // Get A2DP profile proxy
        bluetoothAdapter?.getProfileProxy(
            reactContext,
            object : BluetoothProfile.ServiceListener {
                override fun onServiceConnected(profile: Int, proxy: BluetoothProfile) {
                    if (profile == BluetoothProfile.A2DP) {
                        a2dpProxy = proxy as BluetoothA2dp
                    }
                }
                
                override fun onServiceDisconnected(profile: Int) {
                    if (profile == BluetoothProfile.A2DP) {
                        a2dpProxy = null
                    }
                }
            },
            BluetoothProfile.A2DP
        )
        
        // Register broadcast receivers
        val filter = IntentFilter().apply {
            addAction(AudioManager.ACTION_HEADSET_PLUG)
            addAction(BluetoothA2dp.ACTION_CONNECTION_STATE_CHANGED)
            addAction(AudioManager.RINGER_MODE_CHANGED_ACTION)
        }
        reactContext.registerReceiver(audioReceiver, filter)
    }

    override fun invalidate() {
        super.invalidate()
        try {
            reactContext.unregisterReceiver(audioReceiver)
        } catch (e: Exception) {
            // Already unregistered
        }
        a2dpProxy?.let {
            bluetoothAdapter?.closeProfileProxy(BluetoothProfile.A2DP, it)
        }
    }

    @ReactMethod
    fun addListener(eventName: String) {
        listenerCount++
    }

    @ReactMethod
    fun removeListeners(count: Int) {
        listenerCount -= count
    }

    /**
     * Get all connected Bluetooth audio devices
     */
    @ReactMethod
    fun getConnectedDevices(promise: Promise) {
        try {
            val devices = Arguments.createArray()
            
            a2dpProxy?.connectedDevices?.forEach { device ->
                devices.pushMap(Arguments.createMap().apply {
                    putString("address", device.address)
                    putString("name", device.name)
                    putString("type", "a2dp")
                    putBoolean("isConnected", true)
                    putBoolean("isTapir", device.name?.contains("TAPIR", ignoreCase = true) == true)
                })
            }
            
            promise.resolve(devices)
        } catch (e: SecurityException) {
            promise.reject("PERMISSION_ERROR", "Bluetooth permission required", e)
        } catch (e: Exception) {
            promise.reject("ERROR", e.message, e)
        }
    }

    /**
     * Set the active A2DP device for audio output
     * Pass null to route to phone speaker
     */
    @ReactMethod
    fun setActiveA2dpDevice(address: String?, promise: Promise) {
        try {
            val proxy = a2dpProxy
            if (proxy == null) {
                promise.reject("NOT_READY", "A2DP proxy not available")
                return
            }
            
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                // Android 10+ has setActiveDevice
                val device = if (address != null) {
                    bluetoothAdapter?.getRemoteDevice(address)
                } else {
                    null
                }
                
                // Use reflection to call setActiveDevice (not in public API but works)
                try {
                    val method = proxy.javaClass.getMethod("setActiveDevice", BluetoothDevice::class.java)
                    val result = method.invoke(proxy, device) as? Boolean ?: false
                    promise.resolve(result)
                } catch (e: NoSuchMethodException) {
                    promise.reject("UNSUPPORTED", "setActiveDevice not available on this device")
                }
            } else {
                // Older Android - limited control
                promise.reject("UNSUPPORTED", "Active device control requires Android 10+")
            }
        } catch (e: SecurityException) {
            promise.reject("PERMISSION_ERROR", "Bluetooth permission required", e)
        } catch (e: Exception) {
            promise.reject("ERROR", e.message, e)
        }
    }

    /**
     * Check if a specific device is connected via A2DP
     */
    @ReactMethod
    fun isDeviceConnected(address: String, promise: Promise) {
        try {
            val device = bluetoothAdapter?.getRemoteDevice(address)
            val isConnected = device?.let { 
                a2dpProxy?.getConnectionState(it) == BluetoothProfile.STATE_CONNECTED 
            } ?: false
            promise.resolve(isConnected)
        } catch (e: Exception) {
            promise.reject("ERROR", e.message, e)
        }
    }

    /**
     * Check if wired headphones are connected to the phone
     */
    @ReactMethod
    fun isWiredHeadphonesConnected(promise: Promise) {
        try {
            val devices = audioManager.getDevices(AudioManager.GET_DEVICES_OUTPUTS)
            val hasWired = devices.any { 
                it.type == AudioDeviceInfo.TYPE_WIRED_HEADPHONES ||
                it.type == AudioDeviceInfo.TYPE_WIRED_HEADSET ||
                it.type == AudioDeviceInfo.TYPE_USB_HEADSET
            }
            promise.resolve(hasWired)
        } catch (e: Exception) {
            promise.reject("ERROR", e.message, e)
        }
    }

    /**
     * Get current ringer mode (normal, vibrate, silent)
     */
    @ReactMethod
    fun getRingerMode(promise: Promise) {
        try {
            val mode = audioManager.ringerMode
            promise.resolve(ringerModeToString(mode))
        } catch (e: Exception) {
            promise.reject("ERROR", e.message, e)
        }
    }

    /**
     * Check if screen is on
     */
    @ReactMethod
    fun isScreenOn(promise: Promise) {
        try {
            val powerManager = reactContext.getSystemService(Context.POWER_SERVICE) as android.os.PowerManager
            promise.resolve(powerManager.isInteractive)
        } catch (e: Exception) {
            promise.reject("ERROR", e.message, e)
        }
    }

    /**
     * Start Bluetooth SCO for voice communication
     */
    @ReactMethod
    fun startBluetoothSco(promise: Promise) {
        try {
            @Suppress("DEPRECATION")
            audioManager.startBluetoothSco()
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("ERROR", e.message, e)
        }
    }

    /**
     * Stop Bluetooth SCO
     */
    @ReactMethod
    fun stopBluetoothSco(promise: Promise) {
        try {
            @Suppress("DEPRECATION")
            audioManager.stopBluetoothSco()
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("ERROR", e.message, e)
        }
    }

    private fun ringerModeToString(mode: Int): String = when (mode) {
        AudioManager.RINGER_MODE_NORMAL -> "normal"
        AudioManager.RINGER_MODE_VIBRATE -> "vibrate"
        AudioManager.RINGER_MODE_SILENT -> "silent"
        else -> "normal"
    }

    private fun sendEvent(eventName: String, params: WritableMap) {
        if (listenerCount > 0) {
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit(eventName, params)
        }
    }
}

