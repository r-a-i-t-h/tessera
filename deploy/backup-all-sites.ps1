#!/usr/bin/env pwsh
#requires -Version 7.0
<#
.SYNOPSIS
Run deploy/backup-site.sh for every Tessera instance under /opt/tessera/.

.EXAMPLE
sudo /opt/tessera/www/current/deploy/backup-all-sites.ps1
#>
[CmdletBinding()]
param(
    [string]$TesseraRoot = $(if ($env:TESSERA_ROOT) { $env:TESSERA_ROOT } else { '/opt/tessera' })
)

$ErrorActionPreference = 'Stop'

function Write-Step([string]$Message) {
    Write-Host "backup-all-sites: $Message"
}

function Write-Warn([string]$Message) {
    Write-Host "backup-all-sites: $Message" -ForegroundColor Yellow
}

function Test-TesseraInstance([string]$Dir) {
    $envFile = Join-Path $Dir 'env'
    if (-not (Test-Path -LiteralPath $envFile)) { return $false }
    foreach ($line in [System.IO.File]::ReadAllLines($envFile)) {
        if ($line -match '^PORT=') { return $true }
    }
    return $false
}

function Get-ServiceUser([string]$InstancePath) {
    $name = Split-Path -Leaf $InstancePath
    $unit = "/etc/systemd/system/tessera-$name.service"
    if (-not (Test-Path -LiteralPath $unit)) { return $null }
    foreach ($line in [System.IO.File]::ReadAllLines($unit)) {
        if ($line -match '^\s*User\s*=\s*(.+)$') {
            return $Matches[1].Trim()
        }
    }
    return $null
}

$backupSite = Join-Path $PSScriptRoot 'backup-site.sh'
if (-not (Test-Path -LiteralPath $backupSite)) {
    throw "missing $backupSite"
}

$bash = Get-Command bash -ErrorAction SilentlyContinue
if (-not $bash) {
    throw 'bash is required (install bash or run backup-all-sites.sh directly)'
}

if (-not (Test-Path -LiteralPath $TesseraRoot)) {
    throw "no Tessera root at $TesseraRoot"
}

$instances = @(Get-ChildItem -LiteralPath $TesseraRoot -Directory |
    Where-Object { Test-TesseraInstance $_.FullName } |
    Sort-Object Name)

if ($instances.Count -eq 0) {
    throw "no Tessera instances under $TesseraRoot"
}

$ok = 0
$failed = 0
$isRoot = $(if ($IsWindows) { $false } else { [int](id -u) -eq 0 })

foreach ($inst in $instances) {
    $name = $inst.Name
    Write-Step "instance $name"
    try {
        if ($isRoot) {
            $user = Get-ServiceUser $inst.FullName
            if ($user) {
                $cmd = "$($backupSite.Replace("'", "'\''")) $($inst.FullName.Replace("'", "'\''"))"
                & su -s /bin/sh $user -c $cmd
                if ($LASTEXITCODE -ne 0) { throw "exit $LASTEXITCODE" }
            }
            else {
                Write-Warn "no tessera-$name.service User=; running backup as root"
                & bash $backupSite $inst.FullName
                if ($LASTEXITCODE -ne 0) { throw "exit $LASTEXITCODE" }
            }
        }
        else {
            & bash $backupSite $inst.FullName
            if ($LASTEXITCODE -ne 0) { throw "exit $LASTEXITCODE" }
        }
        $ok++
    }
    catch {
        Write-Warn "backup failed for $name"
        $failed++
    }
}

Write-Step "finished: $ok ok, $failed failed ($($instances.Count) instance(s))"
if ($failed -gt 0) { exit 1 }
