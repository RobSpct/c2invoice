' Startet den Token-Ledger-Proxy (Port 11435) ohne sichtbares Fenster.
' Der Proxy sitzt zwischen dem Modell-Werkzeug und Ollama und schreibt mit, wie viele
' Tokens die lokalen Modelle verbrauchen. Ohne ihn wird nichts erfasst.
' Verknuepft im Autostart-Ordner, damit die Erfassung keine Luecken bekommt.
Dim shell, fso, projektDir
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

' Ordner dieses Skripts -> eine Ebene hoeher liegt ollama-proxy.js
projektDir = fso.GetParentFolderName(fso.GetParentFolderName(WScript.ScriptFullName))
shell.CurrentDirectory = projektDir

' 0 = verstecktes Fenster, False = nicht auf Ende warten
shell.Run "cmd /c node ollama-proxy.js", 0, False
