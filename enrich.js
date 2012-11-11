function findOne(property){
	for(var name in property) {}
	for(var i in this){
		if(this[i][name] == property[name]) return this[i];
	}
}

function removeOne(property){
	for(var name in property) {}
	for(var i in this){
		if(this[i][name] == property[name]){
			this.splice(i, 1);
			break;
		}
	}
}

function merge(/* variable number of arrays */){
	for(var i = 0; i < arguments.length; i++){
		var array = arguments[i];
		for(var j = 0; j < array.length; j++){
			if(this.indexOf(array[j]) === -1) {
				this.push(array[j]);
			}
		}
	}
	return this;
}

function deepclone(){
	var nA = [];
	for(var i in this){
		if(typeof this[i] == 'object'){
			var obj = this[i],
			    nObj = {};
			for(var j in obj){
				nObj[j] = obj[j];
			}
			nA.push(nObj);
		}
		else nA.push(this[i]);
	}
	return nA;
}

function countChildren(){
  var t = 0;
  for(var i in this) t++;
  return t;
}

Object.defineProperty(Array.prototype, 'findOne', {value: findOne});
Object.defineProperty(Array.prototype, 'removeOne', {value: removeOne});
Object.defineProperty(Array.prototype, 'merge', {value: merge});
Object.defineProperty(Array.prototype, 'deepclone', {value: deepclone});
Object.defineProperty(Object.prototype, 'countChildren', {value: countChildren});