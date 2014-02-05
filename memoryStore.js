function MemoryStore(options){
  this.entries = {};
  this.index = [];
  this.size = 0;
  this.maxSize = options.maxMemoryStoreSize || 1e10;
}
(function(){
  this.put = function put(query, img){
    var size = img.length;
    this.entries[query] = img;
    this.index.push({size: size, query: query});
    this.size += size;
    if(this.size > this.maxSize) this.prune();
  };
  this.getIndex = function getIndex(query){
    var index = this.index, i;
    for(i in index){
      if(index[i].query === query) return i;
    }
  };
  this.getIndexLoose = function getIndexLoose(query){
    var index = this.index,
        rQuery = new RegExp(query),
        i;
    for(i in index){
      if(rQuery.test(index[i].query)) return i;
    }
  };
  this.get = function get(query){
    if(this.entries[query]) {
      //put it in front
      var i = this.getIndex(query);
      this.index.push(this.index.splice(i,1)[0]);
      return this.entries[query];
    }
    return false;
  };
  this.prune = function prune(){
    var cSize = this.size, amt = 0, i;
    while(this.size > this.maxSize){
      this.removeEntry(this.index[0].query, 0);
      amt++;
    }
    console.log('memoryCache pruned. Items removed: ' + amt + ', cookies regained: ' + (cSize - this.size), ', current size: ', this.size );
  };
  this.removeEntry = function removeEntry(query, i){
    i = i || this.getIndex(query);
    var entry;

    if(i){
      entry = this.index[i];
      delete this.entries[query];
      this.size -= entry.size;
      this.index.splice(i, 1);
    }
  };
  this.removeEntryLoose = function removeEntryLoose(query){
    var entry = this.index[this.getIndexLoose(query)];
    this.removeEntry(entry.query);
  };
}).call(MemoryStore.prototype);

module.exports = MemoryStore;