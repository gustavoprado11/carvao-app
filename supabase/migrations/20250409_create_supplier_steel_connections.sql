-- Tabela para rastrear conexões persistentes entre fornecedores e siderúrgicas
-- Quando um fornecedor compartilha documentos com uma siderúrgica, uma conexão é criada
-- Novos documentos são automaticamente compartilhados com todas as conexões ativas
CREATE TABLE IF NOT EXISTS supplier_steel_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  steel_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  disconnected_at TIMESTAMPTZ DEFAULT NULL,

  -- Garante que não há conexões duplicadas entre o mesmo par
  CONSTRAINT unique_supplier_steel_pair UNIQUE (supplier_profile_id, steel_profile_id)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_connections_supplier ON supplier_steel_connections(supplier_profile_id) WHERE disconnected_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_connections_steel ON supplier_steel_connections(steel_profile_id) WHERE disconnected_at IS NULL;

-- RLS Policies
ALTER TABLE supplier_steel_connections ENABLE ROW LEVEL SECURITY;

-- Fornecedor pode ver suas próprias conexões
CREATE POLICY "Suppliers can view their connections"
  ON supplier_steel_connections
  FOR SELECT
  USING (supplier_profile_id = auth.uid());

-- Siderúrgica pode ver conexões com ela
CREATE POLICY "Steels can view connections with them"
  ON supplier_steel_connections
  FOR SELECT
  USING (steel_profile_id = auth.uid());

-- Fornecedor pode criar/atualizar suas próprias conexões
CREATE POLICY "Suppliers can manage their connections"
  ON supplier_steel_connections
  FOR ALL
  USING (supplier_profile_id = auth.uid())
  WITH CHECK (supplier_profile_id = auth.uid());

-- Função para criar ou reativar uma conexão
CREATE OR REPLACE FUNCTION connect_supplier_to_steel(
  p_supplier_profile_id UUID,
  p_steel_profile_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verifica se o usuário atual é o dono do perfil de fornecedor
  IF p_supplier_profile_id != auth.uid() THEN
    RAISE EXCEPTION 'Não autorizado a criar conexão para este fornecedor';
  END IF;

  -- Insere ou reativa a conexão
  INSERT INTO supplier_steel_connections (supplier_profile_id, steel_profile_id, disconnected_at)
  VALUES (p_supplier_profile_id, p_steel_profile_id, NULL)
  ON CONFLICT (supplier_profile_id, steel_profile_id)
  DO UPDATE SET disconnected_at = NULL;
END;
$$;

-- Função para desconectar (soft delete)
CREATE OR REPLACE FUNCTION disconnect_supplier_from_steel(
  p_supplier_profile_id UUID,
  p_steel_profile_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verifica se o usuário atual é o dono do perfil de fornecedor
  IF p_supplier_profile_id != auth.uid() THEN
    RAISE EXCEPTION 'Não autorizado a remover conexão para este fornecedor';
  END IF;

  -- Marca a conexão como desconectada
  UPDATE supplier_steel_connections
  SET disconnected_at = NOW()
  WHERE supplier_profile_id = p_supplier_profile_id
    AND steel_profile_id = p_steel_profile_id;

  -- Revoga todos os compartilhamentos de documentos deste fornecedor com esta siderúrgica
  UPDATE document_shares
  SET revoked_at = NOW()
  WHERE document_id IN (
    SELECT id FROM documents WHERE owner_profile_id = p_supplier_profile_id
  )
  AND shared_with_profile_id = p_steel_profile_id
  AND revoked_at IS NULL;
END;
$$;

-- Função para buscar conexões ativas de um fornecedor
CREATE OR REPLACE FUNCTION get_active_steel_connections(p_supplier_profile_id UUID)
RETURNS TABLE (steel_profile_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verifica se o usuário atual é o dono do perfil ou se é admin
  IF p_supplier_profile_id != auth.uid() AND NOT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND type = 'admin'
  ) THEN
    RAISE EXCEPTION 'Não autorizado a buscar conexões deste fornecedor';
  END IF;

  RETURN QUERY
  SELECT ssc.steel_profile_id
  FROM supplier_steel_connections ssc
  WHERE ssc.supplier_profile_id = p_supplier_profile_id
    AND ssc.disconnected_at IS NULL;
END;
$$;
