# convert-xml-to-json 1.0.0

function xml2json {
    param (
        [parameter(valuefrompipeline)] $xml_file
    )
    process {
        [Newtonsoft.Json.JsonConvert]::SerializeXmlNode([xml](get-content $xml_file), 1) | Set-Content "$xml_file.json"
    }
}

# Run this in a PurpleCms xml folder

dir ./*.config | xml2json

dir ./content/*.xml | xml2json

# extract the currently published content version for each page

dir ./content/*.xml.json | %{ $fn = $_; $o = (get-content $fn | convertfrom-json); $latest = $o.Content.Versions.Version | ? "@id" -eq $o.Content.Status.Publish."@version"; if ($latest) { $latest|add-member "id" ($fn.name -replace ".xml.json","")};$latest|ConvertTo-Json|set-content ($fn -replace ".json","-current.json"); }

# gather the latest versions into a single rec-tem data file

dir ./content/*-current.json | %{$wraps = @()}{ $fn = $_; $o = (get-content $fn | convertfrom-json); $id = $o.id; $wrap = [pscustomobject]@{id = $o.id; tags = "page"; parentId = "template-basic"; relatedItems = @(); content = ($o | select -excludeproperty id,"@id")}; $wraps += $wrap}{$wraps|convertto-json -depth 99|set-content ./pages-converted.json}
