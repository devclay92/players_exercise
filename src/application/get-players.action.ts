import { Injectable } from '@nestjs/common';
import { Filter } from 'src/domain/filter.value-object';
import { Player } from 'src/domain/player.entity';
import { PlayerRepositoryPort } from './ports/player-repository.port';

@Injectable()
export class GetPlayersAction {
  public constructor(private readonly playerRepository: PlayerRepositoryPort) {}

  execute(params?: Filter): Array<Player> {
    return this.playerRepository.getPlayers(params);
  }
}
