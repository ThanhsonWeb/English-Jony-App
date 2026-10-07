// Keep authentication documents separate from the user contract sent to clients.
const CLIENT_USER_FIELDS = "_id name email role photo avatar theme totalXp createdAt updatedAt";
const AUTH_USER_FIELDS = `${CLIENT_USER_FIELDS} googleId passwordChangedAt passwordSessionVersion`;

function clientUser(user) {
	const result = {};
	for (const field of CLIENT_USER_FIELDS.split(" ")) {
		if (user[field] !== undefined) result[field] = user[field];
	}
	return result;
}

module.exports = { CLIENT_USER_FIELDS, AUTH_USER_FIELDS, clientUser };
