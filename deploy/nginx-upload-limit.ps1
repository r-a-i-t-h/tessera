#!/usr/bin/env pwsh
#requires -Version 7.0
<#
.SYNOPSIS
Raise client_max_body_size for one Tessera instance.

.DESCRIPTION
node-vps-kit writes one nginx server file per instance and does not rewrite
it on update. The 1m default rejects a library upload before the API sees it.
This edits only the server that proxies this instance, not the http block.

The API allows 100 MiB per request unless TESSERA_UPLOAD_MAX_TOTAL_BYTES is
set. Nginx is set 5 MiB higher so multipart overhead still reaches the API.
A backup of the conf file is kept until nginx -t and the restart both succeed.

.EXAMPLE
sudo /opt/tessera/www/current/deploy/nginx-upload-limit.ps1

.EXAMPLE
sudo /opt/tessera/www/current/deploy/nginx-upload-limit.ps1 www
#>
[CmdletBinding()]
param(
    [Parameter(Position = 0)]
    [string]$Instance
)

$ErrorActionPreference = 'Stop'

function Write-Step([string]$Message) {
    Write-Host "nginx-upload-limit: $Message"
}

function Get-EnvValue([string]$Path, [string]$Key) {
    foreach ($line in [System.IO.File]::ReadAllLines($Path)) {
        if ($line -match "^$([regex]::Escape($Key))=(.*)$") {
            return $Matches[1].Trim()
        }
    }
    return $null
}

function Find-InstanceFrom([string]$Start) {
    $dir = $Start
    while ($dir -and $dir -ne [System.IO.Path]::DirectorySeparatorChar) {
        $envFile = Join-Path $dir 'env'
        if ((Test-Path -LiteralPath $envFile) -and (Get-EnvValue $envFile 'PORT')) {
            return $dir
        }
        $parent = Split-Path -Parent $dir
        if (-not $parent -or $parent -eq $dir) { break }
        $dir = $parent
    }
    return $null
}

function Resolve-TesseraInstance([string]$Given) {
    if ($Given) {
        if (Test-Path -LiteralPath (Join-Path $Given 'env')) { return $Given }
        $named = Join-Path '/opt/tessera' $Given
        if (Test-Path -LiteralPath (Join-Path $named 'env')) { return $named }
        throw "no instance env file for $Given"
    }

    $found = Find-InstanceFrom $PSScriptRoot
    if (-not $found) { $found = Find-InstanceFrom (Get-Location).Path }
    if ($found) { return $found }

    $envs = @(Get-ChildItem -LiteralPath '/opt/tessera' -Directory -ErrorAction SilentlyContinue |
        Where-Object { Test-Path -LiteralPath (Join-Path $_.FullName 'env') })
    if ($envs.Count -eq 1) { return $envs[0].FullName }
    if ($envs.Count -gt 1) {
        Write-Step 'several Tessera instances. Pass the instance name:'
        foreach ($env in $envs) { Write-Step "  $($env.Name)" }
        throw 'pass the instance name'
    }
    throw 'could not find an instance env file. Run it from /opt/tessera/<name>/current or pass the instance name.'
}

# 0 means unlimited. Nginx k/m/g are powers of 1024, same as PowerShell's KB/MB/GB.
function ConvertTo-NginxBytes([string]$Token) {
    if ($Token -notmatch '^(?<n>\d+)(?<u>[kmgKMG]?)$') {
        throw "cannot parse client_max_body_size $Token"
    }
    $n = [int64]$Matches.n
    switch ($Matches.u.ToLowerInvariant()) {
        'k' { return $n * 1KB }
        'm' { return $n * 1MB }
        'g' { return $n * 1GB }
        default { return $n }
    }
}

function Get-NginxCode([string]$Line) {
    $hash = $Line.IndexOf('#')
    if ($hash -ge 0) { return $Line.Substring(0, $hash) }
    return $Line
}

function Get-AnnotatedLines([string[]]$Raw) {
    $depth = 0
    $lines = foreach ($text in $Raw) {
        $code = Get-NginxCode $text
        $before = $depth
        $depth += ([regex]::Matches($code, '\{')).Count - ([regex]::Matches($code, '\}')).Count
        if ($depth -lt 0) { throw 'extra closing brace' }
        [pscustomobject]@{
            Text        = $text
            Code        = $code
            DepthBefore = $before
            DepthAfter  = $depth
        }
    }
    return @($lines)
}

function Find-EnclosingStart($Lines, [int]$At) {
    for ($j = $At; $j -ge 0; $j--) {
        $isAncestor = $Lines[$j].DepthBefore -lt $Lines[$At].DepthBefore
        if ($isAncestor -and $Lines[$j].Code -match '^\s*server\s*\{') { return $j }
    }
    for ($j = $At; $j -ge 0; $j--) {
        $isAncestor = $Lines[$j].DepthBefore -lt $Lines[$At].DepthBefore
        if ($isAncestor -and $Lines[$j].Code -match '^\s*location\s' -and $Lines[$j].Code.Contains('{')) {
            return $j
        }
    }
    return $null
}

function Find-BlockEnd($Lines, [int]$Start) {
    $openedAt = $Lines[$Start].DepthBefore
    for ($j = $Start + 1; $j -lt $Lines.Count; $j++) {
        if ($Lines[$j].DepthAfter -eq $openedAt) { return $j }
    }
    throw "block starting at line $($Start + 1) does not close"
}

function Test-BodyDirective($Lines, [int]$Start, [int]$End, [int]$BodyDepth) {
    for ($j = $Start + 1; $j -lt $End; $j++) {
        $code = $Lines[$j].Code -replace ';', ''
        $atBody = $Lines[$j].DepthBefore -eq $BodyDepth
        if ($atBody -and $code -match '^\s*client_max_body_size\s+\d+[kKmMgG]?\s*$') { return $true }
    }
    return $false
}

function Get-ProxyBlocks($Lines, [int]$Port) {
    $blocks = @()
    $seen = @{}
    for ($i = 0; $i -lt $Lines.Count; $i++) {
        if ($Lines[$i].Code -notmatch "proxy_pass\s+https?://(127\.0\.0\.1|localhost):$Port(?!\d)") { continue }
        $start = Find-EnclosingStart $Lines $i
        if ($null -eq $start) { throw "proxy_pass for port $Port is not inside a server or location block" }
        if ($seen.ContainsKey($start)) { continue }
        $seen[$start] = $true
        $end = Find-BlockEnd $Lines $start
        $blocks += [pscustomobject]@{
            Start  = $start
            End    = $end
            Insert = -not (Test-BodyDirective $Lines $start $end ($Lines[$start].DepthBefore + 1))
        }
    }
    return @($blocks)
}

function Get-Indent([string]$Line) {
    if ($Line -match '^(\s+)') { return $Matches[1] }
    return '    '
}

# Returns the edited conf, or $null when every relevant limit is already high enough.
function Update-NginxUploadConf {
    param(
        [Parameter(Mandatory)][string]$Path,
        [Parameter(Mandatory)][int]$Port,
        [Parameter(Mandatory)][int64]$TargetBytes,
        [Parameter(Mandatory)][string]$TargetToken
    )

    $raw = [System.IO.File]::ReadAllLines($Path)
    if ($raw.Length -eq 0) { throw "$Path is empty" }
    $lines = @(Get-AnnotatedLines $raw)
    $blocks = @(Get-ProxyBlocks $lines $Port)
    if ($blocks.Count -eq 0) {
        throw "found proxy_pass for port $Port in the running config but not in $Path"
    }

    $changed = $false
    $out = foreach ($i in 0..($lines.Count - 1)) {
        $insert = $blocks | Where-Object { $_.Start -eq $i -and $_.Insert } | Select-Object -First 1
        if ($insert) {
            $changed = $true
            $lines[$i].Text
            $next = if ($i + 1 -lt $lines.Count) { $lines[$i + 1].Text } else { '' }
            "$(Get-Indent $next)client_max_body_size $TargetToken;"
            continue
        }

        $code = $lines[$i].Code -replace ';', ''
        $inside = $blocks | Where-Object { $i -gt $_.Start -and $i -lt $_.End } | Select-Object -First 1
        if ($inside -and $code -match '^(?<indent>\s*)client_max_body_size\s+(?<size>\d+[kKmMgG]?)\s*$') {
            $bytes = ConvertTo-NginxBytes $Matches.size
            if ($bytes -ne 0 -and $bytes -lt $TargetBytes) {
                $changed = $true
                "$($Matches.indent)client_max_body_size $TargetToken;"
                continue
            }
        }
        $lines[$i].Text
    }

    if (-not $changed) { return $null }
    return ((@($out) -join "`n") + "`n")
}

function Get-ProxyConfPath([string]$Dump, [int]$Port) {
    $conf = $null
    $current = $null
    foreach ($line in ($Dump -split '\r?\n')) {
        if ($line -match '^# configuration file (.+):$') {
            $current = $Matches[1]
            continue
        }
        $code = Get-NginxCode $line
        if ($code -match "proxy_pass\s+https?://(127\.0\.0\.1|localhost):$Port(?!\d)") {
            if (-not $current) { throw "proxy_pass for port $Port appeared before any configuration file header" }
            if ($conf -and $conf -ne $current) { throw "port $Port is proxied from both $conf and $current" }
            $conf = $current
        }
    }
    if (-not $conf) { throw "no nginx proxy_pass to 127.0.0.1:$Port" }
    if (-not (Test-Path -LiteralPath $conf)) { throw "nginx listed $conf but that file is not there" }
    return (Resolve-Path -LiteralPath $conf).Path
}

function Invoke-NginxUploadLimit {
    if ((& id -u) -ne '0') { throw 'run with sudo' }
    foreach ($cmd in 'nginx', 'systemctl') {
        if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) { throw "$cmd is not installed" }
    }

    $root = Resolve-TesseraInstance $Instance
    $name = Split-Path -Leaf $root
    $envFile = Join-Path $root 'env'
    $portText = Get-EnvValue $envFile 'PORT'
    if ($portText -notmatch '^\d+$') { throw "PORT is missing in $envFile" }
    $port = [int]$portText

    $apiText = Get-EnvValue $envFile 'TESSERA_UPLOAD_MAX_TOTAL_BYTES'
    $apiTotal = if ($apiText) { [int64]$apiText } else { 100MB }
    if ($apiTotal -lt 1) { throw "TESSERA_UPLOAD_MAX_TOTAL_BYTES in $envFile is not a positive integer" }
    # 5 MiB above the API total, rounded up to a whole MiB.
    $targetMiB = [int][Math]::Ceiling(($apiTotal + 5MB) / 1MB)
    $targetBytes = [int64]$targetMiB * 1MB
    $targetToken = "${targetMiB}m"
    Write-Step "instance $name, port $port, client_max_body_size $targetToken"

    $backup = $null
    $real = $null
    $work = Join-Path ([System.IO.Path]::GetTempPath()) ("nginx-upload-limit-" + [guid]::NewGuid().ToString('n'))
    New-Item -ItemType Directory -Path $work | Out-Null
    try {
        $errFile = Join-Path $work 'nginx-t.err'
        $dump = & nginx -T 2>$errFile
        if ($LASTEXITCODE -ne 0) {
            Get-Content -LiteralPath $errFile | Write-Host
            throw 'nginx -t failed while reading the configuration'
        }
        $real = Get-ProxyConfPath ($dump -join "`n") $port
        Write-Step "editing $real"

        $updated = Update-NginxUploadConf -Path $real -Port $port -TargetBytes $targetBytes -TargetToken $targetToken
        if ($null -eq $updated) {
            Write-Step "already $targetToken or higher in $real"
            return
        }

        # /tmp, not next to the conf: sites-enabled/* would load a copy sitting beside it.
        $backup = New-TemporaryFile
        Write-Step "copying $real to $($backup.FullName)"
        Copy-Item -LiteralPath $real -Destination $backup.FullName -Force
        Write-Step "writing client_max_body_size $targetToken into $real"
        [System.IO.File]::WriteAllText($real, $updated)

        Write-Step 'testing nginx configuration'
        & nginx -t
        if ($LASTEXITCODE -ne 0) { throw 'nginx -t failed' }

        Write-Step 'restarting nginx'
        & systemctl restart nginx
        if ($LASTEXITCODE -ne 0) { throw 'nginx restart failed' }

        Write-Step "removing $($backup.FullName)"
        Remove-Item -LiteralPath $backup.FullName -Force
        $backup = $null
        Write-Step 'done'
    }
    catch {
        if ($backup) {
            Write-Step "stopped. The original conf is still at $($backup.FullName)"
            Write-Step "the edited file is $real"
            Write-Step "restore with: cp -a '$($backup.FullName)' '$real'"
        }
        throw
    }
    finally {
        if (Test-Path -LiteralPath $work) { Remove-Item -LiteralPath $work -Recurse -Force }
    }
}

if ($MyInvocation.InvocationName -ne '.') {
    Invoke-NginxUploadLimit
}
