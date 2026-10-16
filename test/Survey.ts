import { expect } from "chai";
import { network } from "hardhat";

type Question = {
  question: string;
  options: string[];
};

describe("Survey init", () => {
  const title = "막무가내 설문조사라면";
  const description =
    "중앙화된 설문조사로서, 모든 데이터는 공개되지 않으며 설문조사를 게시한자만 볼 수 있습니다.";
  const questions: Question[] = [
    {
      question: "누가 내 응답을 관리할때 더 솔직할 수 있을까요?",
      options: [
        "구글폼 운영자",
        "탈중앙화된 블록체인 (관리주체 없으며 모든 데이터 공개)",
        "상관없음",
      ],
    },
  ];

  const getSurveyContractAndEthers = async (survey: {
    title: string;
    description: string;
    targetNumber: number;
    questions: Question[];
  }) => {
    const { ethers } = await network.connect();
    const cSurvey = await ethers.deployContract("Survey", [
      survey.title,
      survey.description,
      survey.targetNumber,
      survey.questions,
    ]);
    return { ethers, cSurvey };
  };

  // 보상 풀(ETH)을 넣어서 배포해야 하는 테스트용 헬퍼
  const getFundedSurvey = async (targetNumber: number, pool: string) => {
    const { ethers } = await network.connect();
    const cSurvey = await ethers.deployContract(
      "Survey",
      [title, description, targetNumber, questions],
      { value: ethers.parseEther(pool) }
    );
    return { ethers, cSurvey };
  };

  describe("Deployment", () => {
    it("should store survey info correctly", async () => {
      const { cSurvey } = await getSurveyContractAndEthers({
        title,
        description,
        targetNumber: 100,
        questions,
      });

      expect(await cSurvey.title()).to.equal(title);
      expect(await cSurvey.description()).to.equal(description);
      expect(await cSurvey.targetNumber()).to.equal(100n);
    });

    it("should calculate rewardAmount correctly", async () => {
      const { ethers, cSurvey } = await getFundedSurvey(100, "50");

      // 50 ETH / 100명 = 0.5 ETH
      expect(await cSurvey.rewardAmount()).to.equal(ethers.parseEther("0.5"));
      expect(await ethers.provider.getBalance(cSurvey.target)).to.equal(
        ethers.parseEther("50")
      );
    });
  });

  describe("Questions and Answers", () => {
    it("should return questions correctly", async () => {
      const { cSurvey } = await getSurveyContractAndEthers({
        title,
        description,
        targetNumber: 100,
        questions,
      });

      const stored = await cSurvey.getQuestions();
      expect(stored.length).to.equal(questions.length);
      expect(stored[0].question).to.equal(questions[0].question);
      expect([...stored[0].options]).to.deep.equal(questions[0].options);
    });

    it("should allow valid answer submission", async () => {
      const { ethers, cSurvey } = await getFundedSurvey(10, "1");
      const [, respondent] = await ethers.getSigners();

      await expect(cSurvey.connect(respondent).submitAnswer([1])).to.not.revert(
        ethers
      );

      const answers = await cSurvey.getAnswers();
      expect(answers.length).to.equal(1);
      expect(answers[0].respondent).to.equal(respondent.address);
      expect([...answers[0].answers]).to.deep.equal([1n]);
      expect(await cSurvey.hasAnswered(respondent.address)).to.equal(true);
    });

    it("should revert if answer length mismatch", async () => {
      const { ethers, cSurvey } = await getFundedSurvey(10, "1");
      const [, respondent] = await ethers.getSigners();

      // 질문은 1개인데 답은 2개
      await expect(
        cSurvey.connect(respondent).submitAnswer([0, 1])
      ).to.be.revertedWith("Answer count mismatch");
    });

    it("should revert if target reached", async () => {
      const { ethers, cSurvey } = await getFundedSurvey(2, "1");
      const [, r1, r2, r3] = await ethers.getSigners();

      await cSurvey.connect(r1).submitAnswer([0]);
      await cSurvey.connect(r2).submitAnswer([1]);

      // 목표 인원 2명 도달 후 3번째 응답
      await expect(cSurvey.connect(r3).submitAnswer([2])).to.be.revertedWith(
        "Survey is closed"
      );
    });
  });

  describe("Rewards", () => {
    it("should pay correct reward to respondent", async () => {
      const { ethers, cSurvey } = await getFundedSurvey(2, "1");
      const [, respondent] = await ethers.getSigners();
      const reward = ethers.parseEther("0.5"); // 1 ETH / 2명

      // 응답자 +0.5 ETH, 컨트랙트 -0.5 ETH (가스비 제외)
      await expect(
        cSurvey.connect(respondent).submitAnswer([1])
      ).to.changeEtherBalances(ethers, [respondent, cSurvey], [reward, -reward]);
    });
  });
});
