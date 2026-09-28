import { expect } from "chai";
import { network } from "hardhat";

describe("SurveyFactory Contract", () => {
  let factory: any, owner: any, respondent1: any, respondent2: any;
  let ethers: any;

  // 테스트용 설문 스키마 생성 헬퍼
  const makeSchema = (title: string, targetNumber: number) => ({
    title,
    description: `${title} description`,
    targetNumber,
    questions: [
      { question: "Q1?", options: ["A", "B", "C"] },
      { question: "Q2?", options: ["Yes", "No"] },
    ],
  });

  beforeEach(async () => {
    ({ ethers } = await network.connect());
    [owner, respondent1, respondent2] = await ethers.getSigners();

    factory = await ethers.deployContract("SurveyFactory", [
      ethers.parseEther("50"), // min_pool_amount
      ethers.parseEther("0.1"), // min_reward_amount
    ]);
  });

  it("should deploy with correct minimum amounts", async () => {
    expect(await factory.min_pool_amount()).to.equal(ethers.parseEther("50"));
    expect(await factory.min_reward_amount()).to.equal(ethers.parseEther("0.1"));
  });

  it("should create a new survey when valid values are provided", async () => {
    const schema = makeSchema("Survey 1", 100); // 50 ETH / 100 = 0.5 ETH >= 0.1

    const before = (await factory.getSurveys()).length;

    await expect(
      factory.createSurvey(schema, { value: ethers.parseEther("50") })
    ).to.emit(factory, "SurveyCreated");

    const surveys = await factory.getSurveys();
    expect(surveys.length).to.equal(before + 1);
  });

  it("should revert if pool amount is too small", async () => {
    const schema = makeSchema("Small Pool", 10);

    await expect(
      factory.createSurvey(schema, { value: ethers.parseEther("10") }) // 10 < 50
    ).to.be.revertedWith("Insufficient pool amount"); // 컨트랙트의 require 메시지로 교체
  });

  it("should revert if reward amount per respondent is too small", async () => {
    const schema = makeSchema("Small Reward", 1000); // 50 ETH / 1000 = 0.05 < 0.1

    await expect(
      factory.createSurvey(schema, { value: ethers.parseEther("50") })
    ).to.be.revertedWith("Insufficient reward amount"); // 컨트랙트의 require 메시지로 교체
  });

  it("should store created surveys and return them from getSurveys", async () => {
    await factory.createSurvey(makeSchema("Survey A", 100), {
      value: ethers.parseEther("50"),
    });
    await factory.createSurvey(makeSchema("Survey B", 200), {
      value: ethers.parseEther("100"),
    });
    await factory
      .connect(respondent1)
      .createSurvey(makeSchema("Survey C", 50), { value: ethers.parseEther("60") });

    const surveys = await factory.getSurveys();
    expect(surveys.length).to.equal(3);

    // 각 주소가 유효하고 서로 다른지 확인
    for (const addr of surveys) {
      expect(ethers.isAddress(addr)).to.equal(true);
      expect(addr).to.not.equal(ethers.ZeroAddress);
    }
    expect(new Set(surveys).size).to.equal(3);
  });
});
