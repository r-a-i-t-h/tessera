#!/usr/bin/env pwsh
#requires -Version 7.0
<#
.SYNOPSIS
Install or remove one nightly cron entry that runs deploy/backup-all-sites.ps1.

.DESCRIPTION
Uses the system crontab (Linux). Default schedule is 03:00 UTC daily.
Default crontab user when run with sudo is tessera.

.EXAMPLE
sudo deploy/backup-cron.ps1 install

.EXAMPLE
sudo deploy/backup-cron.ps1 remove
#>
[CmdletBinding()]
param(
    [Parameter(Position = 0, Mandatory = $true)]
    [ValidateSet('install', 'remove', 'cancel', 'status')]
    [string]$Action
)

$ErrorActionPreference = 'Stop'

$Marker = '# tessera-backup-cron'
$DefaultSchedule = '0 3 * * *'
$DefaultUser = 'tessera'

function Write-Step([string]$Message) {
    Write-Host "backup-cron: $Message"
}

function Get-CrontabUser {
    if ($IsWindows) {
        throw 'Windows Task Scheduler is not supported; use backup-cron.sh on Linux or register a task manually.'
    }
    $isRoot = [int](& id -u) -eq 0
    if (-not $isRoot) { return $null }
    $user = if ($env:TESSERA_BACKUP_CRON_USER) { $env:TESSERA_BACKUP_CRON_USER } else { $DefaultUser }
    & id $user 2>$null | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "account $user is not on this machine (set TESSERA_BACKUP_CRON_USER)"
    }
    return $user
}

function Read-Crontab([string]$User) {
    if ($User) {
        $out = & crontab -u $User -l 2>$null
    }
    else {
        $out = & crontab -l 2>$null
    }
    if ($LASTEXITCODE -ne 0) { return '' }
    return ($out -join "`n")
}

function Write-Crontab([string]$User, [string]$Body) {
    if ($User) {
        $Body | & crontab -u $User -
    }
    else {
        $Body | & crontab -
    }
    if ($LASTEXITCODE -ne 0) { throw 'crontab write failed' }
}

function Remove-MarkerLines([string]$Text) {
    if (-not $Text) { return '' }
    $lines = $Text -split "`n" | Where-Object { $_ -notlike "*$Marker*" -and $_.Trim() -ne '' }
    return ($lines -join "`n")
}

function Get-CronLine([string]$Schedule, [string]$Script) {
    return "$Schedule $Script $Marker"
}

$cronUser = Get-CrontabUser
$displayUser = if ($cronUser) { $cronUser } else { (& whoami).Trim() }

switch ($Action) {
    'cancel' { $Action = 'remove' }
}

if ($Action -eq 'install') {
    $schedule = if ($env:TESSERA_BACKUP_CRON_SCHEDULE) { $env:TESSERA_BACKUP_CRON_SCHEDULE } else { $DefaultSchedule }
    $script = Join-Path $PSScriptRoot 'backup-all-sites.ps1'
    if (-not (Test-Path -LiteralPath $script)) {
        $script = Join-Path $PSScriptRoot 'backup-all-sites.sh'
    }
    if (-not (Test-Path -LiteralPath $script)) {
        throw 'missing backup-all-sites.ps1 or backup-all-sites.sh'
    }
    $line = Get-CronLine $schedule $script
    $existing = Read-Crontab $cronUser
    $body = Remove-MarkerLines $existing
    if ($body) {
        $body = "$body`n$line"
    }
    else {
        $body = $line
    }
    Write-Crontab $cronUser $body
    Write-Step "installed crontab for $displayUser"
    Write-Step $line
}
elseif ($Action -eq 'remove') {
    $existing = Read-Crontab $cronUser
    if ($existing -notlike "*$Marker*") {
        Write-Step "no tessera backup cron job for $displayUser"
        return
    }
    $body = Remove-MarkerLines $existing
    if ($body) {
        Write-Crontab $cronUser $body
    }
    elseif ($cronUser) {
        & crontab -u $cronUser -r 2>$null
    }
    else {
        & crontab -r 2>$null
    }
    Write-Step "removed tessera backup cron job for $displayUser"
}
elseif ($Action -eq 'status') {
    $existing = Read-Crontab $cronUser
    if ($existing -like "*$Marker*") {
        foreach ($line in ($existing -split "`n")) {
            if ($line -like "*$Marker*") {
                Write-Step "installed: $line"
            }
        }
    }
    else {
        Write-Step "not installed for $displayUser"
    }
}
