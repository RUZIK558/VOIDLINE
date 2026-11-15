#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
SDK="${ANDROID_SDK_ROOT:-/data/android-sdk}"; BT="$SDK/build-tools/35.0.0"; PLATFORM="$SDK/platforms/android-35/android.jar"
mkdir -p android/assets/web/vendor android/out/classes android/out/dex
cp -r public/. android/assets/web/
cat android/android.css >> android/assets/web/style.css
rm -f android/assets/web/assets/*.glb
cp node_modules/three/build/{three.module.js,three.core.js} android/assets/web/vendor/
"$BT/aapt" package -f -M android/AndroidManifest.xml -I "$PLATFORM" -S android/res -A android/assets -F android/out/unsigned.apk
javac -encoding UTF-8 --release 8 -classpath "$PLATFORM" -d android/out/classes android/src/studio/voidline/arena/MainActivity.java
jar cf android/out/classes.jar -C android/out/classes .
"$BT/d8" --lib "$PLATFORM" --min-api 26 --output android/out/dex android/out/classes.jar
(cd android/out/dex && zip -q -u ../unsigned.apk classes.dex)
"$BT/zipalign" -f -p 4 android/out/unsigned.apk android/out/aligned.apk
SIGNING_DIR="${VOIDLINE_SIGNING_DIR:-/data/voidline-signing}"
mkdir -p "$SIGNING_DIR";chmod 700 "$SIGNING_DIR"
if [[ ! -f "$SIGNING_DIR/key.jks" ]];then
 openssl rand -hex 24 > "$SIGNING_DIR/password";chmod 600 "$SIGNING_DIR/password"
 keytool -genkeypair -noprompt -keystore "$SIGNING_DIR/key.jks" -alias voidline -keyalg RSA -keysize 3072 -validity 10000 -dname 'CN=VOIDLINE Development, O=VOIDLINE, C=US' -storepass:file "$SIGNING_DIR/password" -keypass:file "$SIGNING_DIR/password"
fi
mkdir -p dist
"$BT/apksigner" sign --ks "$SIGNING_DIR/key.jks" --ks-key-alias voidline --ks-pass "file:$SIGNING_DIR/password" --out dist/VOIDLINE-0.10.0-Android.apk android/out/aligned.apk
"$BT/apksigner" verify --verbose dist/VOIDLINE-0.10.0-Android.apk
"$BT/aapt" dump badging dist/VOIDLINE-0.10.0-Android.apk | grep -E 'package:|sdkVersion|targetSdkVersion|screenOrientation|launchable-activity'
