function findOne(property){
	for(var name in property) {}
	for(var i in this){
		if(this[i][name] == property[name]) return this[i];
	}
}

function removeOnee(property){
	for(var name in property) {}
	for(var i in this){
		if(this[i][name] == property[name]){
			this.splice(i, 1);
			break;
		}
	}
}

function removeOne(property){
	for(var i in this){
    var matching = true;
    for(var name in property) {
      matching = this[i][name] == property[name];
      if(!matching) break;
    }
		if(matching){
			this.splice(i, 1);
			return true;
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

function pickProperties(names){
	var object = {},
			name;

	for(var i in names){
		name = names[i];
		if(name in this) object[name] = this[name];
	}

	return object;
}

function toCSV( delimiter, seperator ) {
	var arr = [];
	
	seperator = seperator || '=';

	for(var i in this){
		arr.push( i + seperator + this[i] );
	}
	return arr.join(delimiter || ',');
}

Object.defineProperty(Array.prototype, 'findOne', {value: findOne});
Object.defineProperty(Array.prototype, 'removeOne', {value: removeOne});
Object.defineProperty(Array.prototype, 'merge', {value: merge});
Object.defineProperty(Array.prototype, 'deepclone', {value: deepclone});
Object.defineProperty(Object.prototype, 'countChildren', {value: countChildren});
Object.defineProperty(Object.prototype, 'pickProperties', {value: pickProperties});
Object.defineProperty(Object.prototype, 'toCSV', {value: toCSV});