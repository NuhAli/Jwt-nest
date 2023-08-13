import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { AuthDto } from './dto';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { Tokens } from './types';

@Injectable()
export class AuthService {
  constructor(
    private prismaService: PrismaService,
    private jwtService: JwtService,
  ) {}

  async signUpLocal(dto: AuthDto): Promise<Tokens> {
    try {
      const hash = await this.hashData(dto.password);
      const newUser = await this.prismaService.user.create({
        data: {
          email: dto.email,
          hash: hash,
        },
      });

      const tokens = await this.getToken(dto.email, newUser.id);
      await this.updateRtHash(newUser.id, tokens.refresh_token);
      return tokens;
    } catch (error) {
      throw Error(error);
    }
  }

  async signInLocal(dto: AuthDto): Promise<Tokens> {
    try {
      const user = await this.prismaService.user.findFirst({
        where: {
          email: dto.email,
        },
      });
      if (!user) {
        throw new ForbiddenException('User does not exist');
      }
      const passwordMatch = await bcrypt.compare(dto.password, user.hash);

      if (passwordMatch) {
        const tokens = await this.getToken(user.email, user.id);
        await this.updateRtHash(user.id, tokens.refresh_token);
        return tokens;
      } else {
        throw new ForbiddenException('Password is not correct');
      }
    } catch (error) {
      throw Error(error);
    }
  }

  async refresh(userId: number, rt: string): Promise<Tokens> {
    const user = await this.prismaService.user.findUnique({
      where: {
        id: userId,
      },
    });
    if (!user) throw new ForbiddenException('Access denied');
    const compateRt = await bcrypt.compare(rt, user.hashedRt);
    if (!compateRt) throw new ForbiddenException('Access denied');

    const tokens = await this.getToken(user.email, user.id);
    await this.updateRtHash(user.id, tokens.refresh_token);
    return tokens;
  }

  async logout(userId: number) {
    await this.prismaService.user.update({
      where: {
        id: userId,
        hashedRt: {
          not: null,
        },
      },
      data: {
        hashedRt: null,
      },
    });
  }

  async hashData(data: string) {
    return bcrypt.hash(data, 10);
  }

  async getToken(email: string, id: number) {
    const [at, rt] = await Promise.all([
      this.jwtService.signAsync(
        { sub: id, email },
        { secret: 'at-secret', expiresIn: 60 * 15 },
      ),
      this.jwtService.signAsync(
        { sub: id, email },
        { secret: 'rt-secret', expiresIn: 60 * 15 },
      ),
    ]);

    return { access_token: at, refresh_token: rt };
  }

  async updateRtHash(userId: number, refreshToken: string) {
    const hash = await this.hashData(refreshToken);
    await this.prismaService.user.update({
      where: {
        id: userId,
      },
      data: {
        hashedRt: hash,
      },
    });
  }
}
