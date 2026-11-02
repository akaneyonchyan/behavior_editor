param([string]$Root = 'D:\PPS\CodeX_Output\prototypes\behavior-editor-deployer')
$ErrorActionPreference = 'Stop'
$TaskName = 'PPS-BehaviorEditor-AutoDeploy'
$Root = [IO.Path]::GetFullPath($Root)
$Existing = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($Existing -and $Existing.State -eq 'Running') { throw 'Stop or wait for the existing deployment before updating the coordinator.' }
New-Item -ItemType Directory -Force -Path $Root | Out-Null
$Node = (Get-Command node.exe).Source
$Python = (Get-Command python.exe).Source
$NpmCli = Join-Path (Split-Path $Node) 'node_modules/npm/bin/npm-cli.js'
$OpenSSL = 'D:/Git/usr/bin/openssl.exe'
$SshKey = Join-Path $env:USERPROFILE '.ssh/pps-editor-cloud-20261022'
$KnownHosts = Join-Path $env:USERPROFILE '.ssh/pps-editor-cloud-known_hosts'
foreach ($Path in @($NpmCli,$OpenSSL,$SshKey,$KnownHosts)) { if (!(Test-Path -LiteralPath $Path)) { throw "Missing required file: $Path" } }
$Config = @{root=$Root;npmCli=$NpmCli;python=$Python;openssl=$OpenSSL;sshKey=$SshKey;knownHosts=$KnownHosts}
$Utf8 = New-Object System.Text.UTF8Encoding($false)
[IO.File]::WriteAllText((Join-Path $Root 'config.json'),($Config | ConvertTo-Json),$Utf8)
Copy-Item -LiteralPath (Join-Path $PSScriptRoot '../scripts/auto-deploy.mjs') -Destination (Join-Path $Root 'auto-deploy.mjs')
$Launcher = @'
$ErrorActionPreference = 'Stop'
& '__NODE__' (Join-Path $PSScriptRoot 'auto-deploy.mjs') (Join-Path $PSScriptRoot 'config.json') @args
exit $LASTEXITCODE
'@
$Launcher = $Launcher.Replace('__NODE__',$Node.Replace("'","''"))
[IO.File]::WriteAllText((Join-Path $Root 'run.ps1'),$Launcher,$Utf8)
$Action = New-ScheduledTaskAction -Execute "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe" -Argument ('-NoProfile -NonInteractive -WindowStyle Hidden -File "'+(Join-Path $Root 'run.ps1')+'"') -WorkingDirectory $Root
$Triggers = @((New-ScheduledTaskTrigger -AtLogOn -User ([Security.Principal.WindowsIdentity]::GetCurrent().Name)),(New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(5) -RepetitionInterval (New-TimeSpan -Minutes 5)))
$Principal = New-ScheduledTaskPrincipal -UserId ([Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType Interactive -RunLevel Limited
$Settings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Hours 1) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -Hidden
Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Triggers -Principal $Principal -Settings $Settings -Description 'Check GitLab master every 5 minutes; test, build and deploy authenticated behavior editor with rollback.' -Force | Select-Object TaskName,State
Write-Output "Installed. Status: $Root/status.json; logs: $Root/logs"
