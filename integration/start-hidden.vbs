' Startet den Token-Ledger ohne sichtbares Konsolenfenster.
' node.exe ist ein Konsolenprogramm, Windows oeffnet dafuer immer ein Fenster.
' Der Umweg ueber wscript mit Fenstermodus 0 unterdrueckt das.
Option Explicit

Dim shell, fso, hier, server, node, befehl
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

' Ordner dieses Skripts -> eine Ebene hoeher liegt server.js
hier = fso.GetParentFolderName(WScript.ScriptFullName)
server = fso.BuildPath(fso.GetParentFolderName(hier), "server.js")

If Not fso.FileExists(server) Then
  WScript.Echo "server.js nicht gefunden: " & server
  WScript.Quit 1
End If

' Node ueber den Suchpfad aufrufen, damit kein fester Pfad noetig ist.
node = "node.exe"
befehl = """" & node & """ """ & server & """"

shell.CurrentDirectory = fso.GetParentFolderName(hier)
' 0 = kein Fenster, False = nicht auf Ende warten
shell.Run befehl, 0, False
