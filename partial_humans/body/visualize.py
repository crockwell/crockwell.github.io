#!/usr/bin/python

import os


pct = [4,11,24,29,32]
numGroups = len(pct)

print(sum(pct))

numGroups = 5
base = "ds/"
dataNames = ["vlog","cross_task","instructions","youcook"]
dataRichNames = ["VLOG","Cross Task","Instructions","YouCookII"]
pcts = []
#figure out the pcts
for dataName in dataNames:
    pct = []
    for groupNum in range(numGroups):
        pct.append(len(os.listdir("%s/%s/%d" % (base,dataName,groupNum))))
    pcts.append(pct)

fdata = open("dataInfo.js","w")
fdata.write("var dataNames = [%s];\n" % (",".join(map(lambda s: "\"%s\"" % s,dataNames))))
fdata.write("var dataRichNames = [%s];\n" % (",".join(map(lambda s: "\"%s\"" % s, dataRichNames))))
fdata.write("var paths = [%s];\n" % (",".join(map(lambda s: "\"%s/%s\"" % (base,s),dataNames))))
fdata.write("var pcts = new Array();\n")
for i in range(len(dataNames)):
    fdata.write("pcts.push([%s]);\n" % (",".join(map(str,pcts[i]))))
fdata.close()

f = open("view.htm","w")
f.write("<script type='text/javascript' src='popmanage.js'></script>\n")
f.write("<script type='text/javascript' src='dataInfo.js'></script>\n")

f.write("What do 100 representative images look like in Internet video?<br/>")
f.write("Here is an interactive tool for exploring what typical humans look like in four Internet Video datasets<br/>")
f.write("<br/><br/><br/>")

f.write("Each cell is an image from a representative 100 image sample. We have grouped the poses into five categories: <br/>\n")
#f.write("<span style='font-size:100%;padding:5px'>Key:</span> &nbsp; &nbsp;\n")
for i in range(len(pct)):
    f.write("<span id='key%d' style='padding:1px;font-size:100%%'></span> " % i)


f.write("<br><br/>")
#f.write("<span style='font-size:125%'>Pick a dataset</span>")
f.write("You see poses from four datasets: <br/><br/>")

for i in range(len(dataNames)):
    f.write("<span style='margin:1px;padding:1px; background-color:#ddd;border:2px solid black;display:inline;font-size:100%'")
    f.write(" onClick='resetPop(%d)' id='dataPick%d'><a href='#'>%s</a></span>\n" % (i,i,dataRichNames[i]))

f.write("<br/><br/>")
f.write("<table id='popBox' style='border-collapse:collapse;padding:0px;spacing:0px;margin:0px;'>")
f.write("<tr>")
f.write("<td colspan=10 align='center' style='font-size:110%' id='popDescr'>100 Images</td>")
f.write("</tr>")
for i in range(10):
    f.write("<tr>\n")
    for j in range(10):
        k = i*10+j
        triggers = "onmouseover='popTileIn(%d)' onmouseout='popTileOut(%d)'" % (k,k)
        f.write("<td %s id='popTile%d' style='border:2px solid black;'>&nbsp; &nbsp; &nbsp;</td>\n" % (triggers,k))

    #at the very end of the row, we need to make a special thing that shows the image
    if i == 0:
        f.write("<td rowspan=10 style='vertical-align:top;'><img height='300' id='visImg' style='border:2px solid black;'></td>")
    f.write("</tr>\n")
f.write("</table>\n")


f.write("<script>resetPop(0);</script>")
