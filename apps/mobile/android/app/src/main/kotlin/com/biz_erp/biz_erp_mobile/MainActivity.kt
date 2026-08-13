package com.biz_erp.biz_erp_mobile

import android.annotation.SuppressLint
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothSocket
import android.os.Handler
import android.os.Looper
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel
import java.io.OutputStream
import java.util.UUID
import kotlin.concurrent.thread

class MainActivity : FlutterActivity() {

    private val channelName = "com.biz_erp/bluetooth_printer"
    private val sppUuid: UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB")

    private var socket: BluetoothSocket? = null
    private var outputStream: OutputStream? = null

    @Volatile
    private var connected = false

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)

        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, channelName)
            .setMethodCallHandler { call, result ->
                when (call.method) {
                    "getPairedDevices" -> result.success(pairedDevices())
                    "connect" -> {
                        val address = call.argument<String>("address")
                        if (address.isNullOrEmpty()) {
                            result.error("BAD_ARGS", "address required", null)
                        } else {
                            thread {
                                val error = connectInternal(address)
                                post {
                                    if (error == null) result.success(true)
                                    else result.error("CONNECT_FAILED", error, null)
                                }
                            }
                        }
                    }
                    "writeBytes" -> {
                        val bytes = call.argument<ByteArray>("bytes")
                        if (bytes == null) {
                            result.error("BAD_ARGS", "bytes required", null)
                        } else {
                            thread {
                                val error = writeInternal(bytes)
                                post {
                                    if (error == null) result.success(true)
                                    else result.error("WRITE_FAILED", error, null)
                                }
                            }
                        }
                    }
                    "disconnect" -> {
                        thread {
                            disconnectInternal()
                            post { result.success(true) }
                        }
                    }
                    "isConnected" -> result.success(connected)
                    else -> result.notImplemented()
                }
            }
    }

    private fun post(block: () -> Unit) = Handler(Looper.getMainLooper()).post(block)

    @SuppressLint("MissingPermission")
    private fun pairedDevices(): List<Map<String, String>> {
        val adapter = BluetoothAdapter.getDefaultAdapter() ?: return emptyList()
        if (!adapter.isEnabled) return emptyList()
        return adapter.bondedDevices.map { d ->
            mapOf("name" to (d.name ?: "Unknown"), "address" to (d.address ?: ""))
        }
    }

    @SuppressLint("MissingPermission")
    private fun connectInternal(address: String): String? {
        return try {
            disconnectInternal()
            val adapter = BluetoothAdapter.getDefaultAdapter() ?: return "No BT adapter"
            if (!adapter.isEnabled) return "Bluetooth disabled"
            adapter.cancelDiscovery()

            val device = adapter.getRemoteDevice(address)
            var s: BluetoothSocket? = null

            // Strategi 1: SPP UUID standar
            try {
                s = device.createRfcommSocketToServiceRecord(sppUuid)
                s.connect()
            } catch (e1: Exception) {
                runCatching { s?.close() }
                // Strategi 2: reflection port 1 (workaround printer murah)
                try {
                    val m = device.javaClass.getMethod(
                        "createRfcommSocket", Int::class.javaPrimitiveType
                    )
                    s = m.invoke(device, 1) as BluetoothSocket
                    s.connect()
                } catch (e2: Exception) {
                    return "UUID failed: ${e1.message} | Port1 failed: ${e2.message}"
                }
            }

            socket = s
            outputStream = s.outputStream
            connected = true
            null
        } catch (e: Exception) {
            connected = false
            "Connect error: ${e.message}"
        }
    }

    private fun writeInternal(bytes: ByteArray): String? {
        val os = outputStream ?: return "No stream (not connected)"
        val sock = socket ?: return "No socket"
        if (!sock.isConnected) return "Socket reports disconnected"
        return try {
            os.write(bytes)
            os.flush()
            null
        } catch (e: Exception) {
            "Write error: ${e.message}"
        }
    }

    private fun disconnectInternal() {
        runCatching { outputStream?.close() }
        runCatching { socket?.close() }
        outputStream = null
        socket = null
        connected = false
    }
}
