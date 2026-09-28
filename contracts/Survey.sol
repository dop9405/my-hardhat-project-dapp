// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

struct Question {
    string question;
    string[] options;
}

struct Answer {
    address respondent;
    uint8[] answers;
}

contract Survey {
    string public title;
    string public description;
    uint256 public targetNumber;
    uint256 public rewardAmount;
    Question[] private questions;
    Answer[] private answers;
    mapping(address => bool) public hasAnswered;

    constructor(
        string memory _title,
        string memory _description,
        uint256 _targetNumber,
        Question[] memory _questions
    ) payable {
        title = _title;
        description = _description;
        targetNumber = _targetNumber;
        rewardAmount = msg.value / _targetNumber;

        for (uint256 i = 0; i < _questions.length; i++) {
            questions.push();
            Question storage q = questions[i];
            q.question = _questions[i].question;
            for (uint256 j = 0; j < _questions[i].options.length; j++) {
                q.options.push(_questions[i].options[j]);
            }
        }
    }

    function submitAnswer(uint8[] calldata _answers) external {
        require(answers.length < targetNumber, "Survey is closed");
        require(!hasAnswered[msg.sender], "Already answered");
        require(_answers.length == questions.length, "Answer count mismatch");

        hasAnswered[msg.sender] = true;
        answers.push(Answer({respondent: msg.sender, answers: _answers}));
        payable(msg.sender).transfer(rewardAmount);
    }

    function getQuestions() external view returns (Question[] memory) {
        return questions;
    }

    function getAnswers() external view returns (Answer[] memory) {
        return answers;
    }
}
