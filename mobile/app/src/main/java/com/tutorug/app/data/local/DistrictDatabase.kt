package com.tutorug.app.data.local

import android.content.Context
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import com.tutorug.app.R
import com.tutorug.app.data.model.DistrictData

class DistrictDatabase(private val context: Context) {
    
    private var districts: List<DistrictData> = emptyList()
    
    init {
        loadDistricts()
    }
    
    private fun loadDistricts() {
        try {
            val json = context.resources.openRawResource(R.raw.districts)
                .bufferedReader().use { it.readText() }
            val type = object : TypeToken<Map<String, List<DistrictData>>>() {}.type
            val data: Map<String, List<DistrictData>> = Gson().fromJson(json, type)
            districts = data["districts"] ?: emptyList()
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }
    
    fun getDistrict(name: String): DistrictData? {
        return districts.find { it.name.equals(name, ignoreCase = true) }
    }
    
    fun getAllDistricts(): List<DistrictData> = districts
    
    fun getDistrictsByRegion(region: String): List<DistrictData> {
        return districts.filter { it.region.equals(region, ignoreCase = true) }
    }
    
    fun getAllDistrictNames(): List<String> = districts.map { it.name }.sorted()
}
