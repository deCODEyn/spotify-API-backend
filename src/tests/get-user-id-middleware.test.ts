import { UnauthorizedError } from "../errors/unauthorized-error.ts";
import { getUserId } from "../middleware/get-user-id.ts";

describe("Middleware getUserId", () => {
  let appMock: any;
  let requestMock: any;
  let replyMock: any;
  let hookCallback: (...args: any[]) => Promise<void>;

  beforeEach(() => {
    hookCallback = jest.fn();
    appMock = {
      addHook: jest.fn((_hookName, callback) => {
        hookCallback = callback;
      }),
      log: { error: jest.fn() },
    };
    requestMock = {
      jwtVerify: jest.fn(),
    };
    replyMock = {};
    jest.clearAllMocks();
  });

  it("deve popular request.userId quando jwtVerify retornar payload válido", async () => {
    requestMock.jwtVerify.mockResolvedValue({ sub: "user123" });
    getUserId(appMock);
    await hookCallback(requestMock, replyMock);

    expect(requestMock.userId).toBe("user123");
    expect(appMock.log.error).not.toHaveBeenCalled();
  });

  it("deve lançar UnauthorizedError quando jwtVerify falhar", async () => {
    requestMock.jwtVerify.mockRejectedValue(new Error("invalid token"));
    getUserId(appMock);

    await expect(hookCallback(requestMock, replyMock)).rejects.toThrow(
      UnauthorizedError
    );
    expect(appMock.log.error).toHaveBeenCalledWith(
      { err: expect.any(Error) },
      "Falha no middleware getUserId"
    );
  });
});
