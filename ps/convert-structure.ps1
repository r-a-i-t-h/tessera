# convert-structure 1.0.0

$xml = [xml](get-content ./web_structure.config)

$pages = $xml.selectnodes("//Node")

$new = @()

$pages | %{
    $new += @{
        heading = ""
        topbar = $_.Publishing.publish -eq "false"
        show = "*"
        sidebar = $_.Publishing.publish -eq "true"
        fa = ""
        title = $_.Naming.full
        id = $_.Content.guid
        friendly_url_name = $_.Naming.url
    }
}

$new | convertto-json | set-content ./nav.json

<#
{
"@guid": "cf7d6446-a823-476b-8461-48e21aa67a62",
"Naming": {
    "@url": "corporate",
    "@full": "Corporate Events",
    "@menu": "",
    "@trail": ""
},
"Publishing": {
    "@startDate": "",
    "@endDate": "",
    "@publish": "no",
    "@requireSsl": "no"
},
"Content": {
    "@guid": "9c9d2005-cfd0-4ffa-a09f-dbbace528107"
},
#>