const VALID_TITLES = [
  "아빠", "엄마", "수호",
  "친할아버지", "친할머니", "외할아버지", "외할머니",
  "고모", "고모부", "이모", "이모부", "외삼촌", "기타",
];

const VALID_CATEGORIES = ["dad", "mom", "etc"];
const ADMIN_TITLES = ["아빠", "엄마"];
const SUB_ADMIN_TITLES = ["수호"];
const USER_ID_REGEX = /^[a-zA-Z0-9]{3,20}$/;
const PASSWORD_REGEX = /^(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).{5,}$/;

module.exports = {
  VALID_TITLES,
  VALID_CATEGORIES,
  ADMIN_TITLES,
  PASSWORD_REGEX,
  SUB_ADMIN_TITLES,
  USER_ID_REGEX,
};
