import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { Injectable } from '@nestjs/common';
import { JwtPayloadWithRt } from '../types/jwtPayloadWithRt.type';

@Injectable()
export class RtStratergy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: 'rt-secret',
      passReqToCallback: true,
    });
  }

  validate(req: Request, payload: JwtPayloadWithRt) {
    const refreshToken = req.get('authorization').replace('Bearer', '').trim();
    console.log({ ...payload, refreshToken });
    return { ...payload, refreshToken };
  }
}
