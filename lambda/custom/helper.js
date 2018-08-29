module.exports = {
	stripTags: (someTextWithSSMLTags) => {
		var regex = /(<([^>]+)>)/ig; 
		return someTextWithSSMLTags.replace(regex, "");
	},
	countEmptyFields: (intent_obj) => {
		if(typeof intent_obj === "undefined"){
			return 3;
		}
		let slots = intent_obj.slots;
		let count = 0;
		for(let key in slots){
			if(!slots[key].hasOwnProperty('value')){
				count += 1;
			}
		}
		return count;
	},
    getNextListItem: (remaining_questions, list_questions) => {
        if(remaining_questions == 0){
            return false;
        }
		return list_questions[(list_questions.length - remaining_questions)];
	}
}