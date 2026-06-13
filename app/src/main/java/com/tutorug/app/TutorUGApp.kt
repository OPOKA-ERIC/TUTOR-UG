package com.tutorug.app

import android.app.Application
import com.tutorug.app.data.remote.SupabaseClient

class TutorUGApp : Application() {
    override fun onCreate() {
        super.onCreate()
        SupabaseClient.init(this)
    }
}
