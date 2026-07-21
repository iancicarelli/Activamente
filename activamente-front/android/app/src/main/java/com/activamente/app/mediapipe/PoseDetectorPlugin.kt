package com.activamente.app.mediapipe

import android.graphics.Bitmap
import android.media.Image
import android.util.Log
import com.google.mediapipe.framework.image.BitmapImageBuilder
import com.google.mediapipe.tasks.core.BaseOptions
import com.google.mediapipe.tasks.vision.core.RunningMode
import com.google.mediapipe.tasks.vision.poselandmarker.PoseLandmarker
import com.mrousavy.camera.frameprocessors.Frame
import com.mrousavy.camera.frameprocessors.FrameProcessorPlugin
import com.mrousavy.camera.frameprocessors.FrameProcessorPluginRegistry
import com.mrousavy.camera.frameprocessors.VisionCameraProxy
import java.nio.IntBuffer

/**
 * VisionCamera frame processor plugin that runs MediaPipe PoseLandmarker
 * on every camera frame and returns 33 normalized landmarks.
 *
 * Registered as "detectPose" — called from src/modules/PoseDetector.ts.
 */
class PoseDetectorPlugin(
    proxy: VisionCameraProxy,
    options: Map<String, Any>?,
) : FrameProcessorPlugin() {

    private val poseLandmarker: PoseLandmarker

    // detectForVideo() exige timestamps estrictamente crecientes (en ms). Guardamos
    // el último entregado para nunca repetir/retroceder y evitar que MediaPipe lance.
    private var lastTimestampMs: Long = -1L

    // Buffers reutilizados entre frames para evitar asignar ~3.7MB (IntArray) y un
    // Bitmap nuevo en cada frame → elimina la presión de GC del hot path.
    private var cachedArgb: IntArray? = null
    private var cachedBitmap: Bitmap? = null

    init {
        val context = proxy.context
        val baseOptions = BaseOptions.builder()
            .setModelAssetPath("pose_landmarker_full.task") // placed in android/app/src/main/assets/
            .build()
        val landmarkerOptions = PoseLandmarker.PoseLandmarkerOptions.builder()
            .setBaseOptions(baseOptions)
            .setRunningMode(RunningMode.VIDEO)
            .setNumPoses(1)
            .setMinPoseDetectionConfidence(0.5f)
            .setMinPosePresenceConfidence(0.5f)
            .setMinTrackingConfidence(0.5f)
            .build()
        poseLandmarker = PoseLandmarker.createFromOptions(context, landmarkerOptions)
    }

    override fun callback(frame: Frame, arguments: Map<String, Any>?): Any? {
        // Tiempo de conversión YUV → Bitmap.
        val convStartNs = System.nanoTime()
        val bitmap = frameToBitmap(frame) ?: return null
        val convMs = (System.nanoTime() - convStartNs) / 1_000_000.0
        val mpImage = BitmapImageBuilder(bitmap).build()

        // frame.timestamp viene en nanosegundos (ImageInfo.getTimestamp, monotónico).
        // Lo pasamos a ms y forzamos que sea estrictamente mayor al anterior.
        var timestampMs = frame.timestamp / 1_000_000L
        if (timestampMs <= lastTimestampMs) timestampMs = lastTimestampMs + 1
        lastTimestampMs = timestampMs

        // Tiempo de detección MediaPipe (detectForVideo).
        val detStartNs = System.nanoTime()
        val result = poseLandmarker.detectForVideo(mpImage, timestampMs)
        val detMs = (System.nanoTime() - detStartNs) / 1_000_000.0

        Log.d(
            TAG,
            "frame ts=${timestampMs}ms yuv→bitmap=${"%.2f".format(convMs)}ms " +
                "detectForVideo=${"%.2f".format(detMs)}ms",
        )

        val landmarks = result.landmarks().firstOrNull() ?: return emptyList<Any>()

        return landmarks.map { lm ->
            mapOf(
                "x"          to lm.x().toDouble(),
                "y"          to lm.y().toDouble(),
                "z"          to lm.z().toDouble(),
                "visibility" to (lm.visibility().orElse(0f).toDouble()),
            )
        }
    }

    /**
     * Converts a VisionCamera Frame (YUV_420_888) to a Bitmap directly, without the
     * JPEG encode/decode round-trip. Decodes the Y/U/V planes into an ARGB_8888
     * Bitmap in a single pass.
     */
    private fun frameToBitmap(frame: Frame): Bitmap? {
        return try {
            val image = frame.image // android.media.Image
            if (image.planes.size < 3) return null
            yuv420ToBitmap(image)
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }

    /**
     * YUV_420_888 → ARGB_8888 Bitmap. Honors each plane's rowStride/pixelStride so it
     * works for both planar (I420) and semi-planar (NV12/NV21) buffer layouts.
     * Uses full-range BT.601 (JFIF) coefficients to match the previous JPEG path.
     */
    private fun yuv420ToBitmap(image: Image): Bitmap {
        val width = image.width
        val height = image.height
        val pixelCount = width * height

        // Salida en portrait: el sensor entrega landscape, así que el Bitmap rotado
        // 270° tiene dimensiones invertidas (height×width).
        val outWidth = height
        val outHeight = width

        // Reusar el IntArray si las dimensiones no cambiaron; si no, crear y cachear.
        // El tamaño total es el mismo rotado o no, pero el layout que escribimos abajo
        // ya es el del Bitmap portrait (outWidth×outHeight).
        val argb = cachedArgb?.takeIf { it.size == pixelCount }
            ?: IntArray(pixelCount).also { cachedArgb = it }

        val yPlane = image.planes[0]
        val uPlane = image.planes[1]
        val vPlane = image.planes[2]

        val yBuffer = yPlane.buffer
        val uBuffer = uPlane.buffer
        val vBuffer = vPlane.buffer

        val yRowStride = yPlane.rowStride
        val yPixelStride = yPlane.pixelStride
        val uRowStride = uPlane.rowStride
        val uPixelStride = uPlane.pixelStride
        val vRowStride = vPlane.rowStride
        val vPixelStride = vPlane.pixelStride

        for (y in 0 until height) {
            val yRowStart = y * yRowStride
            val chromaRow = y shr 1
            val uRowStart = chromaRow * uRowStride
            val vRowStart = chromaRow * vRowStride

            for (x in 0 until width) {
                val chromaCol = x shr 1

                val yValue = (yBuffer.get(yRowStart + x * yPixelStride).toInt() and 0xFF)
                val uValue = (uBuffer.get(uRowStart + chromaCol * uPixelStride).toInt() and 0xFF) - 128
                val vValue = (vBuffer.get(vRowStart + chromaCol * vPixelStride).toInt() and 0xFF) - 128

                var r = (yValue + 1.402f * vValue).toInt()
                var g = (yValue - 0.344136f * uValue - 0.714136f * vValue).toInt()
                var b = (yValue + 1.772f * uValue).toInt()

                r = r.coerceIn(0, 255)
                g = g.coerceIn(0, 255)
                b = b.coerceIn(0, 255)

                // Rotación 270° escrita directamente en el buffer de salida portrait:
                //   destX = srcY,  destY = (srcWidth - 1) - srcX
                // El índice usa outWidth (= height) como stride de fila.
                val destX = y
                val destY = (width - 1) - x
                val destIndex = destY * outWidth + destX

                // Empaquetado RGBA: copyPixelsFromBuffer hace copia cruda de memoria y
                // ARGB_8888 espera bytes [R,G,B,A]; en little-endian eso es (A<<24)|(B<<16)|(G<<8)|R.
                argb[destIndex] = (0xFF shl 24) or (b shl 16) or (g shl 8) or r
            }
        }

        // Reusar el Bitmap mutable si coincide el tamaño portrait; rellenarlo sin reasignar.
        // El buffer argb ya está rotado 270°, así que copyPixelsFromBuffer entrega el
        // frame en portrait sin necesidad de Matrix ni de un Bitmap nuevo por frame.
        var bitmap = cachedBitmap
        if (bitmap == null || bitmap.width != outWidth || bitmap.height != outHeight) {
            bitmap = Bitmap.createBitmap(outWidth, outHeight, Bitmap.Config.ARGB_8888)
            cachedBitmap = bitmap
        }
        bitmap.copyPixelsFromBuffer(IntBuffer.wrap(argb))

        return bitmap
    }

    companion object {
        private const val TAG = "PosePerf"

        fun register() {
            FrameProcessorPluginRegistry.addFrameProcessorPlugin("detectPose") { proxy, options ->
                PoseDetectorPlugin(proxy, options)
            }
        }
    }
}
