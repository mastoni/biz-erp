import java.util.Properties
import java.io.FileInputStream

plugins {
    id("com.android.application")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

android {
    namespace = "com.biz_erp.biz_erp_mobile"
    compileSdk = 37
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    defaultConfig {
        // TODO: Specify your own unique Application ID (https://developer.android.com/studio/build/application-id.html).
        applicationId = "com.biz_erp.biz_erp_mobile"
        // You can update the following values to match your application needs.
        // For more information, see: https://flutter.dev/to/review-gradle-config.
        minSdk = flutter.minSdkVersion
        targetSdk = 36
        versionCode = flutter.versionCode
        versionName = flutter.versionName
    }

    buildTypes {
        release {
            val keystorePropertiesFile = rootProject.file("key.properties")
            val keystoreProperties = Properties()

            if (keystorePropertiesFile.exists()) {
                keystoreProperties.load(FileInputStream(keystorePropertiesFile))
            }

            val storeFileEnv = System.getenv("KEYSTORE_PATH")
            val storePasswordEnv = System.getenv("KEYSTORE_PASSWORD")
            val keyAliasEnv = System.getenv("KEY_ALIAS")
            val keyPasswordEnv = System.getenv("KEY_PASSWORD")

            val finalStoreFile = storeFileEnv ?: keystoreProperties.getProperty("storeFile")
            val finalStorePassword = storePasswordEnv ?: keystoreProperties.getProperty("storePassword")
            val finalKeyAlias = keyAliasEnv ?: keystoreProperties.getProperty("keyAlias")
            val finalKeyPassword = keyPasswordEnv ?: keystoreProperties.getProperty("keyPassword")

            if (finalStoreFile != null && finalStorePassword != null && finalKeyAlias != null && finalKeyPassword != null) {
                signingConfig = signingConfigs.create("release").apply {
                    storeFile = file(finalStoreFile)
                    storePassword = finalStorePassword
                    keyAlias = finalKeyAlias
                    keyPassword = finalKeyPassword
                }
            } else {
                throw GradleException("Release signing credentials not found. Ensure KEYSTORE_PATH, KEYSTORE_PASSWORD, KEY_ALIAS, and KEY_PASSWORD are set in the environment, or key.properties exists with storeFile, storePassword, keyAlias, and keyPassword.")
            }
        }
    }
}

kotlin {
    compilerOptions {
        jvmTarget = org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17
    }
}

flutter {
    source = "../.."
}
