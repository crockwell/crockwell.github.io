#!/usr/bin/python
import os, shutil

src = "dataset_summaries/"
target = "ds/"

poseTypes = ["fully_visible","no_head","only_arms","other","upper_torso"]

if not os.path.exists(target):
    os.mkdir(target)

sources = os.listdir(src)
sources.sort()

for source in sources:
    if not os.path.exists(target+"/"+source):
        os.mkdir(target+"/"+source)

    fileNum = 0
    for poseTypeI,poseType in enumerate(poseTypes):
        sourceFolders = os.listdir("%s/%s" % (src,source))
        keep = [sourceFolders[i] for i in range(len(sourceFolders)) if sourceFolders[i].startswith(poseType)]
        print(keep[0])
        srcF = "%s/%s/%s" % (src,source,keep[0])
        targetF = "%s/%s/%d" % (target,source,poseTypeI)
        if not os.path.exists(targetF):
            os.mkdir(targetF)

        for jpg in os.listdir(srcF):
             shutil.copyfile("%s/%s" % (srcF,jpg),"%s/%d.jpg" % (targetF,fileNum))
             fileNum += 1


