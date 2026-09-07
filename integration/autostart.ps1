# Richtet den Token-Ledger als Aufgabe ein, die bei der Anmeldung startet.
# Ausfuehren:  powershell -ExecutionPolicy Bypass -File integration\autostart.ps1
# Entfernen:   powershell -ExecutionPolicy Bypass -File integration\autostart.ps1 -Remove
param([switch]$Remove)

$ErrorActionPreference = 'Stop'
$TaskName = 'TokenLedger'
$Root = Split-Path -Parent $PSScriptRoot
$Server = Join-Path $Root 'server.js'

if ($Remove) {
  try {
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
    Write-Host "Aufgabe '$TaskName' entfernt."
  } catch {
    Write-Host "Aufgabe '$TaskName' war nicht vorhanden."
  }
  return
}

if (-not (Test-Path $Server)) { throw "server.js nicht gefunden unter $Server" }

$node = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $node) { throw 'node wurde im PATH nicht gefunden.' }

# node.exe ist ein Konsolenprogramm, Windows oeffnet dafuer immer ein Fenster.
# Der Start ueber wscript.exe unterdrueckt es (Fenstermodus 0 im VBS).
$Starter = Join-Path $PSScriptRoot 'start-hidden.vbs'
if (-not (Test-Path $Starter)) { throw "start-hidden.vbs nicht gefunden unter $Starter" }

$action = New-ScheduledTaskAction -Execute 'wscript.exe' `
  -Argument "//nologo `"$Starter`"" -WorkingDirectory $Root

# Zwei Ausloeser: beim Anmelden, und zusaetzlich alle 10 Minuten. Der zweite
# holt den Dienst zurueck, falls er abgestuerzt oder beendet worden ist —
# laeuft er bereits, verhindert 'IgnoreNew' einen zweiten Start.
$triggerLogon = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
# Ohne RepetitionDuration laeuft die Wiederholung unbegrenzt. TimeSpan::MaxValue
# waere ausserhalb des von Windows erlaubten Bereichs und wird abgelehnt.
$triggerLoop = New-ScheduledTaskTrigger -Once -At (Get-Date) `
  -RepetitionInterval (New-TimeSpan -Minutes 10)

$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
  -StartWhenAvailable -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) `
  -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew

try { Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false } catch {}

Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger @($triggerLogon, $triggerLoop) `
  -Settings $settings -Description 'Token-Ledger: Auswertung des Token-Verbrauchs auf 127.0.0.1' | Out-Null

Start-ScheduledTask -TaskName $TaskName

Write-Host "Aufgabe '$TaskName' eingerichtet und gestartet."
Write-Host "Start bei jeder Anmeldung, Pruefung alle 10 Minuten."
Write-Host "Status:  Get-ScheduledTask -TaskName $TaskName"
