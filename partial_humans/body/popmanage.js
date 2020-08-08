var colors = ["#a66","#6a6","#66a","#aa6","#a6a","#6aa"];
var colorsBright = ["#c44","#4c4","#44c","#cc4","#c4c","#4cc"];
var colorsSuperBright = ["#f00","#0f0","#00f","#ff0","#f0f","#0ff"];
var groupNames = ["Fully Visible","No Head","Only Arms","Other","Upper Torso"]

var currentActiveGroup = -1;
var currentActiveCell = -1;
var cellToGroup = [];
var cellToJPG = []
var currentDatasetName = '';

function tid(k){ 
    idStr = 'popTile'+k;
    return document.getElementById(idStr);
}

function resetPop(dataSetId){
    /* load the right pct */
    pct = pcts[dataSetId];
    prefix = paths[dataSetId]; 
    currentDatasetName = dataRichNames[dataSetId]

    /* compute all the good stuff from pct */
    var cumPctLow = []; var cumPctHigh = []
    var sofar = 0;
    for(var i=0;i<pct.length;i++){
        cumPctLow.push(sofar);
        cumPctHigh.push(sofar+pct[i]);
        sofar += pct[i]; 
    }

    /* reset everything */
    currentActiveCell = -1;
    currentActiveGroup = -1;
    cellToJPG = [];
    cellToGroup = [];

    for(var i = 0; i < 100; i++){
        for(var j = 0; j < pct.length; j++){
            if( (cumPctLow[j] <= i) && (i < cumPctHigh[j]) ){
                cellToGroup.push(j);
            }
        }
    }
    for(var i= 0; i < 100; i++){
        cellToJPG.push(prefix+"/"+cellToGroup[i]+"/"+i+".jpg"); 
    } 

    /* update flavor text */
    for(var j = 0; j < pct.length; j++){
        var basicName = groupNames[j];
        document.getElementById('key'+j).innerHTML = basicName+" ("+pct[j]+"%)";
    }
    document.getElementById('popDescr').innerHTML = '100 Images from '+currentDatasetName;

    /* force image hide */
    document.getElementById('visImg').style.visibility = "hidden";

    /* update the dataset pickers */
    for(var dsI=0; dsI < dataNames.length; dsI++){
        document.getElementById('dataPick'+dsI).style.backgroundColor = (dsI == dataSetId ? '#999' : '#eee');
    }

    render();
}


function render(){
    for(var k=0;k<100;k++){
        var group = cellToGroup[k];
        var el = tid(k);

        if(group == currentActiveGroup){
            if(k == currentActiveCell){
                el.style.backgroundColor= colorsSuperBright[cellToGroup[k]]; 
            } else {
                el.style.backgroundColor= colorsBright[cellToGroup[k]]; 
            }
            /* el.innerHTML = '&nbsp; &middot; &nbsp;' */
        } else {
            el.style.backgroundColor= colors[cellToGroup[k]]; 
            el.innerHTML = '&nbsp; &nbsp; &nbsp;'
        }
    }
    if(currentActiveCell >= 0){
        /* force image visible */
        document.getElementById('visImg').src = cellToJPG[currentActiveCell];
        document.getElementById('visImg').style.visibility = "visible";
    }

    /* set up key */
    for(var j = 0; j < pct.length; j++){
        if(j == currentActiveGroup){
            document.getElementById('key'+j).style.backgroundColor = colorsBright[j];
            document.getElementById('key'+j).style.fontWeight = 'bold';
        } else {
            document.getElementById('key'+j).style.backgroundColor = colors[j];
            document.getElementById('key'+j).style.fontWeight = 'normal';
        }
    } 

/*    document.getElementById('flavortown').innerHTML = groupNames[currentActiveGroup]; */
}

function popTileIn(k){
    /* light up all of the images in the group */
    currentActiveGroup = cellToGroup[k];
    currentActiveCell = k;
    render();
}

function popTileOut(k){
    /*
    never need to do this
    currentActiveGroup = -1;
    render();
    */
}


