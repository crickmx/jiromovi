#!/usr/bin/env python3
"""
Ajusta los proyectos que genera `npx cap add` a lo que piden las tiendas.
Es idempotente: se puede correr de nuevo si alguien regenera un proyecto.

  python3 scripts/native/ajustar-proyectos.py
"""
import re, pathlib

ROOT = pathlib.Path(__file__).resolve().parents[2]

APPS = {
    'movi': dict(display='MOVI Digital', camera='MOVI usa la cámara para que tomes fotos de documentos y pólizas que adjuntas a tus trámites.',
                 photos='MOVI accede a tus fotos solo cuando eliges una imagen para adjuntarla a un trámite o a tu perfil.',
                 # Ubicación (Mi perfil → ubicación para Seguros Express, Multicotizador) y
                 # micrófono (Sala de juntas / Aula virtual). Solo MOVI los usa.
                 extra_plist={
                     'NSLocationWhenInUseUsageDescription': 'MOVI usa tu ubicación, solo cuando tú lo pides, para registrar la zona de tu oficina y asignarte prospectos cercanos.',
                     'NSMicrophoneUsageDescription': 'MOVI usa el micrófono durante las videollamadas y sesiones del Aula Virtual.',
                 },
                 android_perms=['android.permission.CAMERA', 'android.permission.RECORD_AUDIO',
                                'android.permission.MODIFY_AUDIO_SETTINGS',
                                'android.permission.ACCESS_COARSE_LOCATION', 'android.permission.ACCESS_FINE_LOCATION']),
    'seguwallet': dict(display='Seguwallet', camera='Seguwallet usa la cámara para que tomes fotos de tu póliza, tu INE o de un siniestro que quieras reportar.',
                       photos='Seguwallet accede a tus fotos solo cuando eliges una imagen para adjuntarla a un reporte o a tu perfil.'),
}

# MOVI reemplaza en Google Play a "MOVI Digital (beta)" v1.0 (com.wnapp.id1739907855051,
# hecha con un generador de apps): para que entre como ACTUALIZACIÓN usa ese mismo
# package y un versionCode mayor que el publicado (el generador no lo muestra; 100
# deja margen de sobra). En iOS no había app: conserva digital.movi.app.
VERSIONES = {
    'movi':       dict(version='2.0.0', build=100, android_id='com.wnapp.id1739907855051'),
    'seguwallet': dict(version='1.0.0', build=1,   android_id='mx.seguwallet.app'),
}

def plist_set(s, key, value_xml):
    pat = re.compile(r'(\s*<key>' + re.escape(key) + r'</key>\s*)(<[^>]+/>|<string>.*?</string>|<array>.*?</array>|<true/>|<false/>)', re.S)
    if pat.search(s):
        return pat.sub(lambda m: m.group(1) + value_xml, s, count=1)
    return s.replace('</dict>\n</plist>', f'\t<key>{key}</key>\n\t{value_xml}\n</dict>\n</plist>')

for app, cfg in APPS.items():
    VERSION = VERSIONES[app]['version']; BUILD = VERSIONES[app]['build']
    ios = ROOT / 'native' / app / 'ios' / 'App'
    plist = ios / 'App' / 'Info.plist'
    s = plist.read_text()
    s = plist_set(s, 'CFBundleDevelopmentRegion', '<string>es</string>')
    s = plist_set(s, 'CFBundleDisplayName', f"<string>{cfg['display']}</string>")
    s = plist_set(s, 'UIRequiredDeviceCapabilities', '<array>\n\t\t<string>arm64</string>\n\t</array>')
    # Solo iPhone y solo vertical: la app no está diseñada para iPad ni horizontal,
    # y declararlos obliga a subir capturas de iPad y a pasar revisión en ellos.
    s = plist_set(s, 'UISupportedInterfaceOrientations', '<array>\n\t\t<string>UIInterfaceOrientationPortrait</string>\n\t</array>')
    s = re.sub(r'\s*<key>UISupportedInterfaceOrientations~ipad</key>\s*<array>.*?</array>', '', s, flags=re.S)
    # Solo HTTPS estándar → exento de la declaración de cifrado de exportación.
    s = plist_set(s, 'ITSAppUsesNonExemptEncryption', '<false/>')
    # WKWebView ofrece "Tomar foto" en un <input type=file>: sin este texto la app se cierra.
    s = plist_set(s, 'NSCameraUsageDescription', f"<string>{cfg['camera']}</string>")
    s = plist_set(s, 'NSPhotoLibraryUsageDescription', f"<string>{cfg['photos']}</string>")
    s = plist_set(s, 'NSPhotoLibraryAddUsageDescription', '<string>Para guardar en tu galería los documentos e imágenes que descargues.</string>')
    for k, v in cfg.get('extra_plist', {}).items():
        s = plist_set(s, k, f'<string>{v}</string>')
    s = plist_set(s, 'CFBundleLocalizations', '<array>\n\t\t<string>es</string>\n\t</array>')
    plist.write_text(s)

    # Push (APNs): Capacitor necesita que AppDelegate le pase el token del teléfono.
    ad = ios / 'App' / 'AppDelegate.swift'
    a = ad.read_text()
    if 'capacitorDidRegisterForRemoteNotifications' not in a:
        a = a.rstrip()
        assert a.endswith('}')
        a = a[:-1] + '''
    // Push (APNs): Capacitor recibe aquí el token del teléfono (ver src/native/pushNativo.ts).
    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        NotificationCenter.default.post(name: .capacitorDidRegisterForRemoteNotifications, object: deviceToken)
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        NotificationCenter.default.post(name: .capacitorDidFailToRegisterForRemoteNotifications, object: error)
    }
}
'''
        ad.write_text(a)
    # Permiso de push. Xcode lo cambia a "production" solo al archivar para la tienda.
    (ios / 'App' / 'App.entitlements').write_text('''<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
\t<key>aps-environment</key>
\t<string>development</string>
</dict>
</plist>
''')

    pbx = ios / 'App.xcodeproj' / 'project.pbxproj'
    p = pbx.read_text()
    if 'CODE_SIGN_ENTITLEMENTS' not in p:
        p = p.replace('PRODUCT_BUNDLE_IDENTIFIER = ', 'CODE_SIGN_ENTITLEMENTS = App/App.entitlements;\n\t\t\t\tPRODUCT_BUNDLE_IDENTIFIER = ')
    p = p.replace('TARGETED_DEVICE_FAMILY = "1,2";', 'TARGETED_DEVICE_FAMILY = 1;')
    p = re.sub(r'MARKETING_VERSION = [^;]+;', f'MARKETING_VERSION = {VERSION};', p)
    p = re.sub(r'CURRENT_PROJECT_VERSION = [^;]+;', f'CURRENT_PROJECT_VERSION = {BUILD};', p)
    pbx.write_text(p)

    and_ = ROOT / 'native' / app / 'android' / 'app'
    man = and_ / 'src' / 'main' / 'AndroidManifest.xml'
    m = man.read_text()
    # Datos de pólizas y sesión: no van al respaldo en la nube de Google.
    m = m.replace('android:allowBackup="true"', 'android:allowBackup="false"')
    m = m.replace('android:launchMode="singleTask"', 'android:launchMode="singleTask"\n            android:screenOrientation="portrait"')
    m = m.replace('android:screenOrientation="portrait"\n            android:screenOrientation="portrait"', 'android:screenOrientation="portrait"')
    # POST_NOTIFICATIONS: Android 13+ no muestra push sin él (el plugin no lo declara).
    for perm in cfg.get('android_perms', ['android.permission.CAMERA']) + ['android.permission.POST_NOTIFICATIONS']:
        if perm not in m:
            m = m.replace('    <uses-permission android:name="android.permission.INTERNET" />',
                          f'    <uses-permission android:name="android.permission.INTERNET" />\n    <uses-permission android:name="{perm}" />')
    if 'android.hardware.camera' not in m:
        m = m.replace('    <uses-permission android:name="android.permission.INTERNET" />',
                      '    <uses-feature android:name="android.hardware.camera" android:required="false" />\n    <uses-permission android:name="android.permission.INTERNET" />')
    man.write_text(m)

    g = and_ / 'build.gradle'
    t = g.read_text()
    t = re.sub(r'versionName "[^"]+"', f'versionName "{VERSION}"', t)
    t = re.sub(r'versionCode \d+', f'versionCode {BUILD}', t)
    t = re.sub(r'applicationId "[^"]+"', f'applicationId "{VERSIONES[app]["android_id"]}"', t)
    if 'keystore.properties' not in t:
        t = t.replace("apply plugin: 'com.android.application'\n", """apply plugin: 'com.android.application'

// Firma de release: native/<app>/android/keystore.properties (NO se versiona).
//   storeFile=/ruta/a/upload-keystore.jks
//   storePassword=...
//   keyAlias=upload
//   keyPassword=...
def keystorePropsFile = rootProject.file('keystore.properties')
def keystoreProps = new Properties()
if (keystorePropsFile.exists()) { keystoreProps.load(new FileInputStream(keystorePropsFile)) }
""", 1)
        t = t.replace("""    buildTypes {
        release {""", """    signingConfigs {
        release {
            if (keystorePropsFile.exists()) {
                storeFile file(keystoreProps['storeFile'])
                storePassword keystoreProps['storePassword']
                keyAlias keystoreProps['keyAlias']
                keyPassword keystoreProps['keyPassword']
            }
        }
    }
    buildTypes {
        release {
            if (keystorePropsFile.exists()) { signingConfig signingConfigs.release }""", 1)
    g.write_text(t)

    gi = ROOT / 'native' / app / 'android' / '.gitignore'
    gtxt = gi.read_text()
    if 'keystore.properties' not in gtxt:
        gi.write_text(gtxt + '\n# Firma de release — nunca al repo (es público)\nkeystore.properties\n*.jks\n*.keystore\n')

print('Proyectos nativos ajustados.')
