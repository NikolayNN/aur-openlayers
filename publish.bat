@echo off

echo Building aur-openlayers...
call npx ng build lib
if errorlevel 1 goto error

echo Navigating to dist/aur-openlayers...
cd dist/lib
if errorlevel 1 goto error

echo Publishing to npm...
npm publish --access public
if errorlevel 1 goto error

echo Done!
exit /b 0

:error
echo Failed at step above.
exit /b 1
