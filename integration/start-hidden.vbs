' Startet c2invoice ohne sichtbares Konsolenfenster.
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

' Laeuft c2invoice schon (Port lauscht), nicht noch einmal starten: server.js
' oeffnet und migriert die Datenbank beim Laden, also schon vor dem Port-Test
' im Server selbst (R15). Port aus config.json (Schluessel "port" auf oberster
' Ebene, zwei Leerzeichen eingerueckt), sonst 4747. Pruefung ueber WMI
' (MSFT_NetTCPConnection, State 2 = Listen): Windows-eigen, ohne Konsolenfenster,
' anders als netstat ueber shell.Exec.
Dim port, cfgPfad, text, re, treffer, lauscher, anzahl
port = 4747
anzahl = 0
cfgPfad = fso.BuildPath(fso.GetParentFolderName(hier), "config.json")
If fso.FileExists(cfgPfad) Then
  text = fso.OpenTextFile(cfgPfad, 1).ReadAll
  Set re = New RegExp
  re.Pattern = "^  ""port""\s*:\s*(\d+)"
  re.Multiline = True
  Set treffer = re.Execute(text)
  If treffer.Count > 0 Then port = CLng(treffer(0).SubMatches(0))
End If
On Error Resume Next
Set lauscher = GetObject("winmgmts:\\.\root\StandardCimv2").ExecQuery( _
  "SELECT LocalPort FROM MSFT_NetTCPConnection WHERE LocalPort = " & port & " AND State = 2")
' Erst zuweisen, dann vergleichen: ein Fehler in einer If-Bedingung liefe unter
' Resume Next in den Then-Zweig. Scheitert die Abfrage, bleibt anzahl 0 und es
' wird gestartet; der Server endet bei belegtem Port dann selbst.
anzahl = lauscher.Count
Err.Clear
On Error GoTo 0
If anzahl > 0 Then WScript.Quit 0

' Node ueber den Suchpfad aufrufen, damit kein fester Pfad noetig ist.
node = "node.exe"
befehl = """" & node & """ """ & server & """"

shell.CurrentDirectory = fso.GetParentFolderName(hier)
' 0 = kein Fenster, False = nicht auf Ende warten
shell.Run befehl, 0, False
