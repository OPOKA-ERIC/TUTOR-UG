package com.tutorug.app.util

import com.tutorug.app.data.model.UserProfile

object Constants {

    val EDUCATION_LEVELS = listOf(
        "Primary 1", "Primary 2", "Primary 3", "Primary 4",
        "Primary 5", "Primary 6", "Primary 7",
        "S1", "S2", "S3", "S4",
        "S5", "S6",
        "University", "Professional"
    )

    val PRIMARY_SUBJECTS = listOf(
        "English", "Mathematics", "Science", "Social Studies", "Religious Education"
    )

    val O_LEVEL_SUBJECTS = listOf(
        "English Language", "Mathematics", "Biology", "Chemistry", "Physics",
        "Geography", "History", "Commerce", "Agriculture", "CRE",
        "IRE", "Fine Art", "Music", "Physical Education",
        "Computer Studies", "Technical Drawing", "Luganda", "French",
        "Entrepreneurship", "Home Economics"
    )

    // Full A-Level combination letter → subject mapping
    private val A_LEVEL_MAP = mapOf(
        "P" to "Physics",
        "C" to "Chemistry",
        "B" to "Biology",
        "M" to "Mathematics",
        "E" to "Economics",
        "G" to "Geography",
        "H" to "History",
        "L" to "Literature in English",
        "D" to "Divinity",
        "A" to "Art",
        "T" to "Technical Drawing",
        "F" to "French",
        "U" to "Luganda",
        "S" to "Subsidiary ICT",
        "K" to "Kiswahili"
    )

    val REGIONS = listOf("Northern", "Eastern", "Central", "Western", "West Nile")

    // Returns sidebar items for the chat screen based on the user's profile
    fun getSidebarItems(profile: UserProfile): List<String> {
        return when {
            // P1–P7: only 4 core subjects
            profile.educationLevel.startsWith("Primary") -> PRIMARY_SUBJECTS

            // S1–S4: full O-Level subject list
            profile.educationLevel in listOf("S1", "S2", "S3", "S4") -> O_LEVEL_SUBJECTS

            // S5–S6: only subjects from their combination + General Paper
            profile.educationLevel in listOf("S5", "S6") -> {
                val combo = profile.combination.uppercase().trim()
                val subjects = combo.map { letter ->
                    A_LEVEL_MAP[letter.toString()]
                }.filterNotNull().distinct().toMutableList()
                subjects.add("General Paper") // always required
                // If combination was blank or unrecognised, show all A-Level subjects
                if (subjects.size == 1) {
                    A_LEVEL_MAP.values.toList() + listOf("General Paper")
                } else subjects
            }

            // University: show chat history only — no subjects
            profile.educationLevel == "University" -> emptyList()

            // Professional: show chat history only — no subjects
            profile.educationLevel == "Professional" -> emptyList()

            else -> PRIMARY_SUBJECTS
        }
    }

    // Used for document upload subject selection
    fun getSubjectsForLevel(level: String): List<String> {
        return when {
            level.startsWith("Primary") -> PRIMARY_SUBJECTS
            level in listOf("S1", "S2", "S3", "S4") -> O_LEVEL_SUBJECTS
            level in listOf("S5", "S6") -> listOf(
                "Physics", "Chemistry", "Biology", "Mathematics",
                "Economics", "Geography", "History", "Literature",
                "Divinity", "Art", "General Paper"
            )
            else -> listOf("Course Material", "Research", "Professional Skills")
        }
    }
}
