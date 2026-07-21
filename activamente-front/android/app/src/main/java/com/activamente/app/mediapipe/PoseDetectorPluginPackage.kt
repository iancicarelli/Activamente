package com.activamente.app.mediapipe

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

/**
 * ReactPackage that also registers the VisionCamera frame processor plugin.
 * Add this package in MainApplication.getPackages().
 */
class PoseDetectorPluginPackage : ReactPackage {

    override fun createNativeModules(
        reactContext: ReactApplicationContext,
    ): List<NativeModule> = emptyList()

    override fun createViewManagers(
        reactContext: ReactApplicationContext,
    ): List<ViewManager<*, *>> = emptyList()
}
